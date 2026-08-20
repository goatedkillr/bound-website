const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body);}
function bearer(req){const v=req.headers.authorization||'';return v.startsWith('Bearer ')?v.slice(7):null;}
async function verifyUser(token){if(!token)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}});return r.ok?r.json():null;}
async function discordGuilds(token){if(!token)throw new Error('Discord connection expired. Sign out and reconnect Discord.');const r=await fetch('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Discord could not return your servers. Reconnect Discord.');return r.json();}
function canManageGuild(g){if(g.owner)return true;const p=BigInt(g.permissions||'0');return Boolean((p&0x8n)||(p&0x20n));}
function iconUrl(g){return g.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128`:null;}
function compactNumber(v){const n=Number(v||0);if(n>=1e6)return `${(n/1e6).toFixed(2)}M`;if(n>=1e3)return `${(n/1e3).toFixed(1)}K`;return String(n);}

async function rest(path,{method='GET',body,prefer='return=representation'}={}){
  if(!SERVICE_KEY)throw new Error('Vercel is missing SUPABASE_SERVICE_ROLE_KEY.');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{method,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});
  const text=await r.text();let data=null;if(text){try{data=JSON.parse(text);}catch{data=text;}}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase request failed (${r.status})`));return data;
}
async function safe(query,fallback){try{return await query();}catch(error){console.error('Optional dashboard query failed:',error);return fallback;}}
async function authorisedGuild(req,guildId){const guilds=await discordGuilds(req.headers['x-discord-provider-token']);const g=guilds.find(x=>x.id===guildId&&canManageGuild(x));if(!g)throw new Error('You do not have Manage Server permission for this Discord server.');return g;}

export default async function handler(req,res){
  try{
    if(!SERVICE_KEY)return send(res,500,{error:'Vercel is missing SUPABASE_SERVICE_ROLE_KEY.'});
    const user=await verifyUser(bearer(req));if(!user)return send(res,401,{error:'Sign in with Discord first.'});
    const action=String(req.query.action||'bootstrap');const providerToken=req.headers['x-discord-provider-token'];

    if(action==='bootstrap'&&req.method==='GET'){
      const guilds=(await discordGuilds(providerToken)).filter(canManageGuild);const ids=guilds.map(g=>g.id);
      let activation=[];if(ids.length)activation=await safe(()=>rest(`bound_guild_activation?select=guild_id,tos_accepted,tos_version&guild_id=in.(${ids.join(',')})`),[]);
      const map=new Map((activation||[]).map(r=>[r.guild_id,r]));
      return send(res,200,{user:{id:user.user_metadata?.provider_id||user.user_metadata?.sub||user.id,username:user.user_metadata?.user_name||user.user_metadata?.preferred_username||'Discord user',display_name:user.user_metadata?.full_name||user.user_metadata?.name||user.user_metadata?.user_name||'Discord user',avatar_url:user.user_metadata?.avatar_url||user.user_metadata?.picture||null},guilds:guilds.map(g=>({id:g.id,name:g.name,icon_url:iconUrl(g),owner:g.owner,bound_installed:map.has(g.id),tos_accepted:map.get(g.id)?.tos_accepted||false}))});
    }

    const guildId=String(req.query.guild_id||'');if(!guildId)return send(res,400,{error:'guild_id is required.'});const guild=await authorisedGuild(req,guildId);

    if(action==='overview'&&req.method==='GET'){
      const [settings,activation,verify,safetyGuild,safetyCases,cages,gags,balances,activity]=await Promise.all([
        safe(()=>rest(`guild_settings?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`bound_guild_activation?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`verify_settings?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`safety_guilds?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`safety_cases?select=case_id,case_reference,reported_user_id,requested_flag_type,status,reason,created_at&reporter_guild_id=eq.${guildId}&order=created_at.desc&limit=10`),[]),
        safe(()=>rest(`ownership_cages?select=guild_id,sub_id,owner_id,cage_channel_id,created_at&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`bdsm_active_gags?select=gagged_user_id,owner_id,gag_style,expires_at,started_at&guild_id=eq.${guildId}&active=eq.true`),[]),
        safe(()=>rest('user_balances?select=money'),[]),
        safe(()=>rest(`game_activity_history?select=user_id,activity_type,money_earned,created_at&guild_id=eq.${guildId}&order=created_at.desc&limit=8`),[]),
      ]);
      const total=(balances||[]).reduce((s,r)=>s+Number(r.money||0),0);const pending=(safetyCases||[]).filter(x=>['pending','needs_evidence'].includes(x.status)).length;
      return send(res,200,{guild:{id:guild.id,name:guild.name,icon_url:iconUrl(guild)},settings:settings?.[0]||{guild_id:guildId,prefix:'£'},activation:activation?.[0]||null,verification:verify?.[0]||null,safety:{config:safetyGuild?.[0]||null,cases:safetyCases||[],pending,cages:cages||[],active_gags:gags||[]},economy:{total_nugs:total,total_nugs_display:compactNumber(total),users:balances?.length||0},activity:activity||[]});
    }

    if(action==='settings'&&req.method==='PATCH'){
      const prefix=String(req.body?.prefix??'').trimEnd();if(!prefix||prefix.length>5)return send(res,400,{error:'Prefix must be 1–5 characters.'});
      const updated=await rest(`guild_settings?guild_id=eq.${guildId}`,{method:'PATCH',body:{prefix,updated_at:new Date().toISOString()}});
      if(updated?.length)return send(res,200,{settings:updated[0]});
      const inserted=await rest('guild_settings',{method:'POST',body:{guild_id:guildId,prefix}});return send(res,200,{settings:inserted?.[0]||{guild_id:guildId,prefix}});
    }

    return send(res,404,{error:'Unknown dashboard action.'});
  }catch(error){console.error(error);return send(res,500,{error:error instanceof Error?error.message:'Unexpected dashboard error.'});}
}
