import { randomUUID } from 'node:crypto';

const PUBLIC_SUPABASE_URL=process.env.SUPABASE_URL||'https://hpbqoochibnrxzxeuazb.supabase.co';
const PUBLIC_SUPABASE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const PUBLIC_SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVATE_SUPABASE_URL=process.env.PRIVATE_SUPABASE_URL||'https://hobmczasripcpemntobi.supabase.co';
const PRIVATE_SERVICE_KEY=process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const DARK_SIDE_GUILD_ID='1222024653795496006';
const SNOWFLAKE=/^\d{17,20}$/;
const TIMEOUT_MS=12000;

class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
function send(res,status,body,id){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Request-Id',id);return res.status(status).json(body)}
function bearer(req){const v=String(req.headers.authorization||'');return v.startsWith('Bearer ')?v.slice(7):null}
async function fetchTimed(url,options={}){const c=new AbortController();const t=setTimeout(()=>c.abort(),TIMEOUT_MS);try{return await fetch(url,{...options,signal:c.signal})}finally{clearTimeout(t)}}
async function json(url,options={}){const r=await fetchTimed(url,options);const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}if(!r.ok)throw new HttpError(r.status>=500?502:r.status,data?.message||'Connected service request failed');return data}
async function verifyUser(token){if(!token)return null;try{return await json(`${PUBLIC_SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLIC_SUPABASE_KEY,Authorization:`Bearer ${token}`}})}catch{return null}}
async function rest(base,key,path){if(!key)throw new HttpError(503,'Dashboard database connection is not configured');return json(`${base}/rest/v1/${path}`,{headers:{apikey:key,Authorization:`Bearer ${key}`}})}
async function isPremium(guildId){if(!PUBLIC_SERVICE_KEY||!guildId)return false;const rows=await rest(PUBLIC_SUPABASE_URL,PUBLIC_SERVICE_KEY,`premium_dashboard_guilds?select=guild_id&guild_id=eq.${guildId}&active=eq.true&limit=1`);return Boolean(rows?.length)}
function isAdmin(g){if(g?.owner)return true;try{const p=BigInt(g?.permissions||'0');return Boolean((p&0x8n)||(p&0x20n))}catch{return false}}
async function requireGuildAdmin(providerToken,guildId){if(!providerToken)throw new HttpError(401,'Refresh Discord before viewing premium server ticket data');const guilds=await json('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${providerToken}`}});const guild=(guilds||[]).find(g=>g.id===guildId&&isAdmin(g));if(!guild)throw new HttpError(403,'You no longer have permission to manage this server');return guild}
async function ticketStats(guildId){if(!PRIVATE_SERVICE_KEY)throw new HttpError(503,'Private dashboard database is not configured');const rows=await rest(PRIVATE_SUPABASE_URL,PRIVATE_SERVICE_KEY,`tds_tickets?select=status,claimed_by,rating,opened_at,category&guild_id=eq.${guildId}`);const tickets=Array.isArray(rows)?rows:[];const ratings=tickets.map(t=>Number(t.rating||0)).filter(n=>Number.isFinite(n)&&n>0);const open=tickets.filter(t=>String(t.status||'').toLowerCase()==='open');const byCategory=(name)=>tickets.filter(t=>String(t.category||'').toLowerCase()===name).length;return{total:tickets.length,open:open.length,claimed:open.filter(t=>t.claimed_by).length,rated:ratings.length,closed:tickets.filter(t=>String(t.status||'').toLowerCase()==='closed').length,terminated:tickets.filter(t=>String(t.status||'').toLowerCase()==='terminated').length,support:byCategory('support'),id_verify:tickets.filter(t=>String(t.category||'').toLowerCase().includes('id verification')).length,cross_verify:tickets.filter(t=>String(t.category||'').toLowerCase().includes('cross verification')).length,average_rating:ratings.length?Number((ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)):null}}

export default async function handler(req,res){const id=randomUUID();try{
  if(req.method!=='GET')return send(res,405,{error:'Method not allowed',request_id:id},id);
  const user=await verifyUser(bearer(req));if(!user)throw new HttpError(401,'Sign in to Bound first');
  const requested=String(req.query.guild_id||'').trim();
  if(requested&&!SNOWFLAKE.test(requested))throw new HttpError(400,'Invalid Discord server ID');
  const previewStats=await ticketStats(DARK_SIDE_GUILD_ID);
  if(!requested)return send(res,200,{premium:false,source:'preview',guild:{id:DARK_SIDE_GUILD_ID,name:'The Dark Side'},stats:previewStats,request_id:id},id);
  const premium=await isPremium(requested);
  if(premium){
    const guild=await requireGuildAdmin(String(req.headers['x-discord-provider-token']||''),requested);
    return send(res,200,{premium:true,source:'selected',guild:{id:guild.id,name:guild.name},stats:await ticketStats(requested),preview:{guild:{id:DARK_SIDE_GUILD_ID,name:'The Dark Side'},stats:previewStats},request_id:id},id);
  }
  return send(res,200,{premium:false,source:'preview',guild:{id:DARK_SIDE_GUILD_ID,name:'The Dark Side'},stats:previewStats,request_id:id},id);
}catch(error){const status=error instanceof HttpError?error.status:500;console.error(`[ticket-preview ${id}]`,error?.message||error);return send(res,status,{error:error instanceof Error?error.message:'Could not load ticket preview',request_id:id},id)}}
