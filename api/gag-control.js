const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const PUBLIC_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SNOWFLAKE=/^\d{17,20}$/;

function send(res,status,body){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function bearer(req){const v=String(req.headers.authorization||'');return v.startsWith('Bearer ')?v.slice(7):null;}
async function verifyUser(token){if(!token)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${token}`}});return r.ok?r.json():null;}
function discordUserId(u){return String(u?.user_metadata?.provider_id||u?.user_metadata?.sub||u?.identities?.[0]?.identity_data?.sub||'');}
function isAdmin(g){if(g.owner)return true;const p=BigInt(g.permissions||'0');return Boolean(p&0x8n);}
async function verifyGuild(providerToken,guildId){if(!providerToken)throw Object.assign(new Error('Reconnect Discord to manage this server.'),{status:401});const r=await fetch('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${providerToken}`}});if(!r.ok)throw Object.assign(new Error('Discord could not verify your server access.'),{status:r.status===401?401:502});const guilds=await r.json();const g=guilds.find(x=>x.id===guildId&&isAdmin(x));if(!g)throw Object.assign(new Error('Only the server owner or a Discord Administrator can control gag settings.'),{status:403});return g;}
async function rest(path,{method='GET',body,prefer='return=representation'}={}){if(!SERVICE_KEY)throw new Error('Dashboard database connection is missing.');const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{method,headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});const text=await r.text();let data=null;if(text){try{data=JSON.parse(text)}catch{data=text}}if(!r.ok)throw Object.assign(new Error(data?.message||'Database request failed.'),{status:r.status});return data;}

export default async function handler(req,res){
  try{
    if(!['GET','PATCH'].includes(req.method))return send(res,405,{error:'Method not allowed.'});
    const guildId=String(req.query.guild_id||'');if(!SNOWFLAKE.test(guildId))return send(res,400,{error:'Invalid server ID.'});
    const user=await verifyUser(bearer(req));const uid=discordUserId(user);if(!user||!SNOWFLAKE.test(uid))return send(res,401,{error:'Sign in first.'});
    const guild=await verifyGuild(String(req.headers['x-discord-provider-token']||''),guildId);
    if(req.method==='GET'){
      const rows=await rest(`bdsm_safety_config?select=guild_id,gag_enabled,blocked_channel_ids,log_channel_id&guild_id=eq.${guildId}&limit=1`);
      return send(res,200,{guild:{id:guild.id,name:guild.name},config:rows?.[0]||{guild_id:guildId,gag_enabled:true,blocked_channel_ids:[],log_channel_id:null}});
    }
    const enabled=req.body?.gag_enabled;
    if(typeof enabled!=='boolean')return send(res,400,{error:'gag_enabled must be true or false.'});
    const current=await rest(`bdsm_safety_config?select=guild_id&guild_id=eq.${guildId}&limit=1`);
    let rows;
    if(current?.length) rows=await rest(`bdsm_safety_config?guild_id=eq.${guildId}`,{method:'PATCH',body:{gag_enabled:enabled,configured_by:uid,updated_at:new Date().toISOString()}});
    else rows=await rest('bdsm_safety_config',{method:'POST',body:{guild_id:guildId,gag_enabled:enabled,blocked_channel_ids:[],log_channel_id:null,configured_by:uid}});
    return send(res,200,{saved:true,config:rows?.[0]||{guild_id:guildId,gag_enabled:enabled}});
  }catch(error){return send(res,error?.status||500,{error:error instanceof Error?error.message:'Unexpected gag control error.'});}
}
