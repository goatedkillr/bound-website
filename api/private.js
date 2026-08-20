import { randomUUID } from 'node:crypto';

const PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const PUBLIC_SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const PUBLIC_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVATE_SUPABASE_URL = process.env.PRIVATE_SUPABASE_URL || 'https://hobmczasripcpemntobi.supabase.co';
const PRIVATE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const SNOWFLAKE = /^\d{17,20}$/;
const TIMEOUT_MS = 12_000;
const DEFAULT_MODULES = { staff:true,tickets:true,economy:true,subscriptions:true,moderation:true,automation:true,safety:true,levels:true,afk:true,logging:true };

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function send(res,status,body,id){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Request-Id',id);return res.status(status).json(body);}
function bearer(req){const v=String(req.headers.authorization||'');return v.startsWith('Bearer ')?v.slice(7):null;}
function cleanText(value,max,fallback=''){const v=String(value??'').trim();if(!v)return fallback;if(v.length>max||/[\u0000-\u001f]/.test(v))throw new HttpError(400,'One of the customisation values is invalid.');return v;}
async function fetchTimed(url,options={}){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}}
async function verifyUser(token){if(!token)return null;const r=await fetchTimed(`${PUBLIC_SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLIC_SUPABASE_KEY,Authorization:`Bearer ${token}`}});return r.ok?r.json():null;}
function discordUserId(u){return String(u?.user_metadata?.provider_id||u?.user_metadata?.sub||u?.identities?.[0]?.identity_data?.sub||u?.id||'');}
function canManageGuild(g){if(g.owner)return true;const p=BigInt(g.permissions||'0');return Boolean((p&0x8n)||(p&0x20n));}
async function authorisedGuild(providerToken,guildId){if(!providerToken)throw new HttpError(401,'Discord connection expired. Reconnect Discord.');const r=await fetchTimed('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${providerToken}`}});if(r.status===401||r.status===403)throw new HttpError(401,'Discord connection expired. Reconnect Discord.');if(!r.ok)throw new HttpError(502,'Discord could not verify this server right now.');const guilds=await r.json();const guild=guilds.find(g=>g.id===guildId&&canManageGuild(g));if(!guild)throw new HttpError(403,'You do not have Manage Server permission for this Discord server.');return guild;}
async function serviceRest(baseUrl,key,path,{method='GET',body,prefer='return=representation'}={}){if(!key)throw new HttpError(503,'A required dashboard database connection is not configured.');const r=await fetchTimed(`${baseUrl}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});const text=await r.text();let data=null;if(text){try{data=JSON.parse(text);}catch{data=text;}}if(!r.ok)throw new HttpError(r.status>=500?502:r.status,'Dashboard database request failed.');return data;}
const publicRest=(path,opts)=>serviceRest(PUBLIC_SUPABASE_URL,PUBLIC_SERVICE_KEY,path,opts);
const privateRest=(path,opts)=>serviceRest(PRIVATE_SUPABASE_URL,PRIVATE_SERVICE_KEY,path,opts);
async function safe(fn,fallback){try{return await fn();}catch(e){console.error('private dashboard optional query:',e?.message||e);return fallback;}}
function sum(rows,key){return rows.reduce((n,row)=>n+Number(row?.[key]||0),0);}
async function getEntitlement(userId,guildId){if(!PUBLIC_SERVICE_KEY)throw new HttpError(503,'Premium access validation is not configured.');const grants=await publicRest(`premium_bot_custom_grants?select=id,user_id,guild_id,granted_at,note&user_id=eq.${userId}&order=granted_at.desc`);return(grants||[]).find(g=>g.guild_id===null||String(g.guild_id)===guildId)||null;}
async function getControl(guildId){const rows=await safe(()=>privateRest(`bound_private_build_controls?select=*&guild_id=eq.${guildId}&limit=1`),[]);const row=rows?.[0]||null;return{guild_id:guildId,modules:{...DEFAULT_MODULES,...(row?.modules||{})},currency_name:row?.currency_name||'Nugs',currency_icon:row?.currency_icon||'<a:xo_2pinkweedd:1329163451637170229>',bot_display_name:row?.bot_display_name||null,bot_avatar_url:row?.bot_avatar_url||null,command_prefix:row?.command_prefix||null};}

export default async function handler(req,res){const requestId=randomUUID();try{
  if(!['GET','PATCH'].includes(req.method))return send(res,405,{error:'Method not allowed.',request_id:requestId},requestId);
  const guildId=String(req.query.guild_id||'');if(!SNOWFLAKE.test(guildId))throw new HttpError(400,'Invalid Discord server ID.');
  const user=await verifyUser(bearer(req));const uid=discordUserId(user);if(!user||!SNOWFLAKE.test(uid))throw new HttpError(401,'Sign in with Discord first.');
  const guild=await authorisedGuild(String(req.headers['x-discord-provider-token']||''),guildId);
  const grant=await getEntitlement(uid,guildId);
  if(!grant)return send(res,200,{guild:{id:guild.id,name:guild.name},entitled:false,private_build:null,request_id:requestId},requestId);
  if(!PRIVATE_SERVICE_KEY)return send(res,200,{guild:{id:guild.id,name:guild.name},entitled:true,configured:false,private_build:{display_name:guild.name,premium:true,modules:DEFAULT_MODULES,control:{modules:DEFAULT_MODULES,currency_name:'Nugs',currency_icon:'<a:xo_2pinkweedd:1329163451637170229>'},stats:{}},request_id:requestId},requestId);

  if(req.method==='PATCH'){
    const current=await getControl(guildId),patch=req.body||{},modules={...current.modules};
    if(patch.modules&&typeof patch.modules==='object')for(const key of Object.keys(DEFAULT_MODULES))if(typeof patch.modules[key]==='boolean')modules[key]=patch.modules[key];
    const currencyName=patch.currency_name===undefined?current.currency_name:cleanText(patch.currency_name,24,'Nugs');
    const currencyIcon=patch.currency_icon===undefined?current.currency_icon:cleanText(patch.currency_icon,100,'💰');
    const botDisplayName=patch.bot_display_name===undefined?current.bot_display_name:(cleanText(patch.bot_display_name,32,'')||null);
    const avatarRaw=patch.bot_avatar_url===undefined?current.bot_avatar_url:String(patch.bot_avatar_url||'').trim();if(avatarRaw&&!/^https:\/\//i.test(avatarRaw))throw new HttpError(400,'Bot avatar must be an HTTPS image URL.');
    const prefix=patch.command_prefix===undefined?current.command_prefix:(cleanText(patch.command_prefix,8,'')||null);
    const rows=await privateRest('bound_private_build_controls',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body:{guild_id:guildId,modules,currency_name:currencyName,currency_icon:currencyIcon,bot_display_name:botDisplayName,bot_avatar_url:avatarRaw||null,command_prefix:prefix,configured_by:uid,updated_at:new Date().toISOString()}});
    return send(res,200,{saved:true,control:rows?.[0]||await getControl(guildId),request_id:requestId},requestId);
  }

  const control=await getControl(guildId);const registry=await safe(()=>privateRest(`bound_private_dashboard_servers?select=guild_id,display_name,enabled,brand,premium&guild_id=eq.${guildId}&enabled=eq.true&limit=1`),[]);const registered=registry?.[0]||null;const modules=control.modules;
  const[tickets,staffShifts,staffMembers,economy,subscriptions,moderation]=await Promise.all([
    modules.tickets?safe(()=>privateRest(`tds_tickets?select=id,status,claimed_by,rating,opened_at&guild_id=eq.${guildId}`),[]):[],
    modules.staff?safe(()=>privateRest(`tds_staff_shifts?select=id,status,clocked_in_at,clocked_out_at&guild_id=eq.${guildId}`),[]):[],
    modules.staff?safe(()=>privateRest(`tds_staff_members?select=user_id&guild_id=eq.${guildId}`),[]):[],
    modules.economy?safe(()=>privateRest(`tds_economy_accounts?select=user_id,wallet,bank,total&guild_id=eq.${guildId}`),[]):[],
    modules.subscriptions?safe(()=>privateRest(`tds_subscriptions?select=user_id,tier,active,custom_role_id,extra_role_id&guild_id=eq.${guildId}`),[]):[],
    modules.moderation?safe(()=>privateRest(`tds_moderation_cases?select=id,case_type,created_at&guild_id=eq.${guildId}&case_type=in.(warn,warning,mute,unmute,kick,ban,jail,release,unjail)`),[]):[],
  ]);
  const openTickets=tickets.filter(t=>t.status==='open'),ratings=tickets.map(t=>Number(t.rating||0)).filter(Boolean),activeStaff=staffShifts.filter(s=>!s.clocked_out_at&&s.status!=='closed'),activeSubscriptions=subscriptions.filter(s=>s.active!==false),tierCounts=activeSubscriptions.reduce((acc,s)=>{acc[s.tier||'unknown']=(acc[s.tier||'unknown']||0)+1;return acc;},{});
  return send(res,200,{guild:{id:guild.id,name:guild.name},entitled:true,grant:{id:grant.id,guild_id:grant.guild_id,granted_at:grant.granted_at},private_build:{guild_id:guildId,display_name:control.bot_display_name||registered?.display_name||guild.name,brand:registered?.brand||'custom',premium:true,modules,control,stats:{tickets:{total:tickets.length,open:openTickets.length,claimed:openTickets.filter(t=>t.claimed_by).length,average_rating:ratings.length?Number((ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)):null},staff:{members:staffMembers.length,active_shifts:activeStaff.length},economy:{users:economy.length,total_nugs:sum(economy,'total')||sum(economy,'wallet')+sum(economy,'bank')},subscriptions:{active:activeSubscriptions.length,tiers:tierCounts},moderation:{cases:moderation.length}}},configured:true,request_id:requestId},requestId);
}catch(e){const status=e instanceof HttpError?e.status:500;console.error(`[private-dashboard ${requestId}]`,e?.message||e);return send(res,status,{error:e instanceof Error?e.message:'Unexpected private dashboard error.',request_id:requestId},requestId);}}
