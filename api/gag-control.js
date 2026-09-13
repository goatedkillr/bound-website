import { databaseRest } from '../server/database.js';
import { getSession, requireSameOrigin } from '../server/auth.js';

const SNOWFLAKE=/^\d{17,20}$/;

function send(res,status,body){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');return res.status(status).json(body);}
function isAdmin(g){if(g.owner)return true;const p=BigInt(g.permissions||'0');return Boolean(p&0x8n);}
async function verifyGuild(providerToken,guildId){if(!providerToken)throw Object.assign(new Error('Reconnect Discord to manage this server.'),{status:401});const r=await fetch('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${providerToken}`}});if(!r.ok)throw Object.assign(new Error('Discord could not verify your server access.'),{status:r.status===401?401:502});const guilds=await r.json();const g=guilds.find(x=>x.id===guildId&&isAdmin(x));if(!g)throw Object.assign(new Error('Only the server owner or a Discord Administrator can control gag settings.'),{status:403});return g;}
const rest=databaseRest;

export default async function handler(req,res){
  try{
    if(!['GET','PATCH'].includes(req.method))return send(res,405,{error:'Method not allowed.'});
    if(req.method!=='GET')requireSameOrigin(req);
    const guildId=String(req.query.guild_id||'');if(!SNOWFLAKE.test(guildId))return send(res,400,{error:'Invalid server ID.'});
    const session=getSession(req);if(!session)return send(res,401,{error:'Sign in first.'});const uid=session.discordUserId;
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
