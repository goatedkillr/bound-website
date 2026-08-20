const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function send(res,status,body){res.setHeader('Cache-Control','no-store');return res.status(status).json(body);}
function bearer(req){const v=req.headers.authorization||'';return v.startsWith('Bearer ')?v.slice(7):null;}
async function verifyUser(token){if(!token)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}});return r.ok?r.json():null;}
async function discordGuilds(token){if(!token)throw new Error('Discord connection expired. Sign out and reconnect Discord.');const r=await fetch('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${token}`}});if(!r.ok)throw new Error('Discord could not return your servers. Reconnect Discord.');return r.json();}
function canManageGuild(g){if(g.owner)return true;const p=BigInt(g.permissions||'0');return Boolean((p&0x8n)||(p&0x20n));}
function iconUrl(g){return g?.icon?`https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128`:null;}
function compactNumber(v){const n=Number(v||0);if(n>=1e6)return `${(n/1e6).toFixed(2)}M`;if(n>=1e3)return `${(n/1e3).toFixed(1)}K`;return String(n);}
function discordUserId(user){return String(user?.user_metadata?.provider_id||user?.user_metadata?.sub||user?.identities?.[0]?.identity_data?.sub||user?.id||'');}

async function rest(path,{method='GET',body,prefer='return=representation'}={}){
  if(!SERVICE_KEY)throw new Error('Vercel is missing SUPABASE_SERVICE_ROLE_KEY.');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{method,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});
  const text=await r.text();let data=null;if(text){try{data=JSON.parse(text);}catch{data=text;}}
  if(!r.ok)throw new Error(typeof data==='string'?data:(data?.message||`Supabase request failed (${r.status})`));
  return data;
}
async function safe(query,fallback){try{return await query();}catch(error){console.error('Optional dashboard query failed:',error);return fallback;}}
async function authorisedGuild(req,guildId){const guilds=await discordGuilds(req.headers['x-discord-provider-token']);const g=guilds.find(x=>x.id===guildId&&canManageGuild(x));if(!g)throw new Error('You do not have Manage Server permission for this Discord server.');return g;}
async function patchOrInsert(table,guildId,patch,insertBase={}){
  const current=await rest(`${table}?select=guild_id&guild_id=eq.${guildId}`);
  if(current?.length)return rest(`${table}?guild_id=eq.${guildId}`,{method:'PATCH',body:{...patch,updated_at:new Date().toISOString()}});
  return rest(table,{method:'POST',body:{guild_id:guildId,...insertBase,...patch}});
}
async function factionForGuild(guildId){
  const rows=await safe(()=>rest(`factions?select=*&home_guild_id=eq.${guildId}&order=created_at.asc`),[]);
  if(rows.length===1)return {status:'approved',approved:true,ambiguous:false,faction:rows[0],matches:1};
  if(rows.length>1)return {status:'needs_owner_migration',approved:false,ambiguous:true,faction:null,matches:rows.length,candidates:rows.map(x=>({faction_id:x.faction_id,faction_name:x.faction_name}))};
  return {status:'awaiting_owner_approval',approved:false,ambiguous:false,faction:null,matches:0};
}

export default async function handler(req,res){
  try{
    if(!SERVICE_KEY)return send(res,500,{error:'Vercel is missing SUPABASE_SERVICE_ROLE_KEY.'});
    const user=await verifyUser(bearer(req));if(!user)return send(res,401,{error:'Sign in with Discord first.'});
    const action=String(req.query.action||'bootstrap');const providerToken=req.headers['x-discord-provider-token'];

    if(action==='bootstrap'&&req.method==='GET'){
      const guilds=(await discordGuilds(providerToken)).filter(canManageGuild);const ids=guilds.map(g=>g.id);
      let activation=[];let factions=[];
      if(ids.length){
        activation=await safe(()=>rest(`bound_guild_activation?select=guild_id,tos_accepted,tos_version&guild_id=in.(${ids.join(',')})`),[]);
        factions=await safe(()=>rest(`factions?select=faction_id,faction_name,home_guild_id&home_guild_id=in.(${ids.join(',')})`),[]);
      }
      const activationMap=new Map((activation||[]).map(r=>[r.guild_id,r]));
      const factionCounts=new Map();for(const f of factions||[])factionCounts.set(f.home_guild_id,(factionCounts.get(f.home_guild_id)||0)+1);
      return send(res,200,{user:{id:discordUserId(user),username:user.user_metadata?.user_name||user.user_metadata?.preferred_username||'Discord user',display_name:user.user_metadata?.full_name||user.user_metadata?.name||user.user_metadata?.user_name||'Discord user',avatar_url:user.user_metadata?.avatar_url||user.user_metadata?.picture||null},guilds:guilds.map(g=>{const c=factionCounts.get(g.id)||0;return{id:g.id,name:g.name,icon_url:iconUrl(g),owner:g.owner,bound_installed:activationMap.has(g.id),tos_accepted:activationMap.get(g.id)?.tos_accepted||false,faction_status:c===1?'approved':c>1?'needs_owner_migration':'awaiting_owner_approval'};})});
    }

    const guildId=String(req.query.guild_id||'');if(!guildId)return send(res,400,{error:'guild_id is required.'});const guild=await authorisedGuild(req,guildId);

    if(action==='overview'&&req.method==='GET'){
      const factionState=await factionForGuild(guildId);
      const factionId=factionState.faction?.faction_id;
      const [settings,activation,verify,safetyGuild,safetyCases,cages,gags,balances,activity,gagConfig,members,upgrades,portfolio,heistStats,userCache]=await Promise.all([
        safe(()=>rest(`guild_settings?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`bound_guild_activation?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`verify_settings?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`safety_guilds?select=*&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`safety_cases?select=case_id,case_reference,reported_user_id,requested_flag_type,status,reason,created_at&reporter_guild_id=eq.${guildId}&order=created_at.desc&limit=10`),[]),
        safe(()=>rest(`ownership_cages?select=guild_id,sub_id,owner_id,cage_channel_id,created_at&guild_id=eq.${guildId}`),[]),
        safe(()=>rest(`bdsm_active_gags?select=gagged_user_id,owner_id,gag_style,expires_at,started_at&guild_id=eq.${guildId}&active=eq.true`),[]),
        safe(()=>rest('user_balances?select=user_id,money'),[]),
        safe(()=>rest(`game_activity_history?select=user_id,activity_type,money_earned,created_at&guild_id=eq.${guildId}&order=created_at.desc&limit=8`),[]),
        safe(()=>rest(`bdsm_safety_config?select=*&guild_id=eq.${guildId}`),[]),
        factionId?safe(()=>rest(`faction_members?select=user_id,faction_role,joined_at&faction_id=eq.${factionId}`),[]):Promise.resolve([]),
        factionId?safe(()=>rest(`faction_upgrades?select=upgrade_type,upgrade_level,total_amount,updated_at&faction_id=eq.${factionId}`),[]):Promise.resolve([]),
        factionId?safe(()=>rest(`faction_stock_portfolios?select=ticker,shares_owned,average_buy_price,total_invested,total_dividends&faction_id=eq.${factionId}`),[]):Promise.resolve([]),
        factionId?safe(()=>rest(`faction_heist_statistics?select=*&faction_id=eq.${factionId}`),[]):Promise.resolve([]),
        safe(()=>rest('bdsm_discord_user_cache?select=user_id,display_name,avatar_url'),[]),
      ]);
      const total=(balances||[]).reduce((s,r)=>s+Number(r.money||0),0);const pending=(safetyCases||[]).filter(x=>['pending','needs_evidence'].includes(x.status)).length;
      const cacheMap=new Map((userCache||[]).map(x=>[x.user_id,x]));const balanceMap=new Map((balances||[]).map(x=>[x.user_id,Number(x.money||0)]));
      const memberRows=(members||[]).map(m=>({...m,display_name:cacheMap.get(m.user_id)?.display_name||m.user_id,avatar_url:cacheMap.get(m.user_id)?.avatar_url||null,balance:balanceMap.get(m.user_id)||0})).sort((a,b)=>b.balance-a.balance);
      return send(res,200,{
        guild:{id:guild.id,name:guild.name,icon_url:iconUrl(guild)},settings:settings?.[0]||{guild_id:guildId,prefix:'£'},activation:activation?.[0]||null,verification:verify?.[0]||null,
        safety:{config:safetyGuild?.[0]||null,cases:safetyCases||[],pending,cages:cages||[],active_gags:gags||[],gag_config:gagConfig?.[0]||{guild_id:guildId,blocked_channel_ids:[],log_channel_id:null}},
        faction:{...factionState,members:memberRows,upgrades:upgrades||[],portfolio:portfolio||[],heist_stats:heistStats?.[0]||null},
        economy:{total_nugs:total,total_nugs_display:compactNumber(total),users:balances?.length||0},activity:activity||[]
      });
    }

    if(action==='settings'&&req.method==='PATCH'){
      const prefix=String(req.body?.prefix??'').trimEnd();if(!prefix||prefix.length>5)return send(res,400,{error:'Prefix must be 1–5 characters.'});
      const updated=await rest(`guild_settings?guild_id=eq.${guildId}`,{method:'PATCH',body:{prefix,updated_at:new Date().toISOString()}});
      if(updated?.length)return send(res,200,{settings:updated[0]});
      const inserted=await rest('guild_settings',{method:'POST',body:{guild_id:guildId,prefix}});return send(res,200,{settings:inserted?.[0]||{guild_id:guildId,prefix}});
    }

    if(action==='toggle'&&req.method==='PATCH'){
      const group=String(req.body?.group||'');const key=String(req.body?.key||'');const value=req.body?.value;
      if(typeof value!=='boolean')return send(res,400,{error:'Toggle value must be true or false.'});const uid=discordUserId(user);
      if(group==='verify'){
        const allowed=new Set(['welcome_enabled','post_verify_enabled','welcome_ping_user','safety_staff_setup_enabled']);if(!allowed.has(key))return send(res,400,{error:'Unsupported verification setting.'});
        const rows=await patchOrInsert('verify_settings',guildId,{[key]:value},{setup_by:uid});return send(res,200,{group,key,value:Boolean(rows?.[0]?.[key]??value),settings:rows?.[0]||null});
      }
      if(group==='safety'){
        const allowed=new Set(['safety_enabled','auto_ban_minor_safety','auto_ban_harassment_tos','auto_ban_network_ban','auto_unban_on_removal']);if(!allowed.has(key))return send(res,400,{error:'Unsupported safety setting.'});
        const rows=await patchOrInsert('safety_guilds',guildId,{[key]:value},{configured_by:uid});return send(res,200,{group,key,value:Boolean(rows?.[0]?.[key]??value),settings:rows?.[0]||null});
      }
      if(group==='faction'){
        const f=await factionForGuild(guildId);if(!f.approved)return send(res,403,{error:f.ambiguous?'This server has multiple linked factions and needs owner migration first.':'Factions are awaiting owner approval for this server.'});
        if(key!=='applications_open')return send(res,400,{error:'Unsupported faction setting.'});
        const rows=await rest(`factions?faction_id=eq.${f.faction.faction_id}`,{method:'PATCH',body:{applications_open:value,updated_at:new Date().toISOString()}});
        return send(res,200,{group,key,value:Boolean(rows?.[0]?.applications_open??value),settings:rows?.[0]||null});
      }
      return send(res,400,{error:'Unsupported setting group.'});
    }

    if(action==='gag_config'&&req.method==='PATCH'){
      const blocked=Array.isArray(req.body?.blocked_channel_ids)?req.body.blocked_channel_ids.map(String).map(x=>x.trim()).filter(Boolean):[];
      const logChannel=String(req.body?.log_channel_id||'').trim()||null;const uid=discordUserId(user);
      if(blocked.length>50)return send(res,400,{error:'Too many blocked gag channels.'});
      const rows=await patchOrInsert('bdsm_safety_config',guildId,{blocked_channel_ids:blocked,log_channel_id:logChannel},{configured_by:uid});
      return send(res,200,{config:rows?.[0]||{guild_id:guildId,blocked_channel_ids:blocked,log_channel_id:logChannel}});
    }

    return send(res,404,{error:'Unknown dashboard action.'});
  }catch(error){console.error(error);return send(res,500,{error:error instanceof Error?error.message:'Unexpected dashboard error.'});}
}
