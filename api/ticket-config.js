import { randomUUID } from 'node:crypto';

const PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const PUBLIC_SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const PUBLIC_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRIVATE_SUPABASE_URL = process.env.PRIVATE_SUPABASE_URL || 'https://hobmczasripcpemntobi.supabase.co';
const PRIVATE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const SNOWFLAKE = /^\d{17,20}$/;
const HEX = /^#?[0-9a-fA-F]{6}$/;
const TIMEOUT_MS = 12_000;

const DEFAULT_SETTINGS = {
  category_id: '', log_channel_id: '', rating_channel_id: '', verification_rating_channel_id: '', staff_role_id: '',
  rating_title: 'Please Rate {staff_name}',
  rating_description: 'Your support ticket **#{ticket_id}** was successfully closed.\n\nPlease rate {staff} based on your experience:\n**1 ⭐ — Bad**\n**2 ⭐ — Poor**\n**3 ⭐ — Okay**\n**4 ⭐ — Good**\n**5 ⭐ — Perfect**',
  rating_thumbnail_url: '{user_icon}', rating_image_url: '', rating_footer: 'Bound • Support Experience',
  ticket_panel_title: '{category} • Case #{case_id}',
  ticket_panel_description: '**Opened by:** {user}\n**Details:** {reason}',
  ticket_panel_footer: 'Bound • Private Support',
  embed_color: '#FFD84D', category_overrides: {},
};
const DEFAULT_PANELS = {
  support: { panel_type:'support', title:'Private Support', description:'Open a private ticket to speak with the support team.', button_label:'Open Support Ticket', image_url:'', questions:['What do you need help with?','Please explain the situation'], button_options:[{type:'support',label:'Open Support Ticket',enabled:true},{type:'report',label:'Submit a Report',enabled:false}] },
  verify: { panel_type:'verify', title:'Trusted Server Verification', description:'Apply for ID verification or cross-server verification.', button_label:'ID Verification', image_url:'', questions:['Server name and invite','What are you applying for?','Tell us about your server'], button_options:[{type:'id_verify',label:'ID Verification',enabled:true},{type:'cross_verify',label:'Cross Verification',enabled:false}] },
};

class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
function send(res,status,body,id){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Request-Id',id);return res.status(status).json(body);}
function bearer(req){const v=String(req.headers.authorization||'');return v.startsWith('Bearer ')?v.slice(7):null;}
async function fetchTimed(url,options={}){const c=new AbortController();const t=setTimeout(()=>c.abort(),TIMEOUT_MS);try{return await fetch(url,{...options,signal:c.signal});}finally{clearTimeout(t);}}
async function verifyUser(token){if(!token)return null;const r=await fetchTimed(`${PUBLIC_SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLIC_SUPABASE_KEY,Authorization:`Bearer ${token}`}});return r.ok?r.json():null;}
function discordUserId(u){return String(u?.user_metadata?.provider_id||u?.user_metadata?.sub||u?.identities?.[0]?.identity_data?.sub||'');}
function isGuildAdmin(g){if(g.owner)return true;const p=BigInt(g.permissions||'0');return Boolean(p&0x8n);}
async function authorisedGuild(providerToken,guildId){if(!providerToken)throw new HttpError(401,'Discord connection expired. Reconnect Discord.');const r=await fetchTimed('https://discord.com/api/v10/users/@me/guilds',{headers:{Authorization:`Bearer ${providerToken}`}});if(r.status===401||r.status===403)throw new HttpError(401,'Discord connection expired. Reconnect Discord.');if(!r.ok)throw new HttpError(502,'Discord could not verify this server right now.');const guilds=await r.json();const guild=guilds.find(g=>g.id===guildId&&isGuildAdmin(g));if(!guild)throw new HttpError(403,'Only the server owner or a Discord Administrator can control ticket settings.');return guild;}
async function rest(base,key,path,{method='GET',body,prefer='return=representation'}={}){if(!key)throw new HttpError(503,'A required dashboard database connection is not configured.');const r=await fetchTimed(`${base}/rest/v1/${path}`,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:prefer},body:body?JSON.stringify(body):undefined});const txt=await r.text();let data=null;if(txt){try{data=JSON.parse(txt)}catch{data=txt}}if(!r.ok)throw new HttpError(r.status>=500?502:r.status,'Dashboard database request failed.');return data;}
const publicRest=(path,opts)=>rest(PUBLIC_SUPABASE_URL,PUBLIC_SERVICE_KEY,path,opts);
const privateRest=(path,opts)=>rest(PRIVATE_SUPABASE_URL,PRIVATE_SERVICE_KEY,path,opts);
async function entitlement(userId,guildId){if(!PUBLIC_SERVICE_KEY)throw new HttpError(503,'Premium access validation is not configured.');const rows=await publicRest(`premium_bot_custom_grants?select=id,guild_id&user_id=eq.${userId}`);return(rows||[]).some(g=>g.guild_id===null||String(g.guild_id)===guildId);}
function text(v,max,fallback=''){const s=String(v??'').trim();if(!s)return fallback;if(s.length>max||/[\u0000-\u001f]/.test(s))throw new HttpError(400,'One of the ticket values is invalid.');return s;}
function maybeSnowflake(v){const s=String(v??'').trim();if(!s)return '';if(!SNOWFLAKE.test(s))throw new HttpError(400,'Channel, role and category fields must be Discord IDs.');return s;}
function maybeUrl(v,allowToken=false){const s=String(v??'').trim();if(!s)return '';if(allowToken&&s==='{user_icon}')return s;if(!/^https:\/\//i.test(s))throw new HttpError(400,'Image fields must use HTTPS URLs.');if(s.length>1000)throw new HttpError(400,'Image URL is too long.');return s;}
function questions(v){if(!Array.isArray(v))return[];return v.map(x=>text(x,100,'')).filter(Boolean).slice(0,5);}
function panelOptions(v,allowed,defaults){if(!Array.isArray(v))return defaults;return allowed.map(type=>{const row=v.find(x=>x?.type===type)||defaults.find(x=>x.type===type);return{type,label:text(row?.label,80,defaults.find(x=>x.type===type)?.label||type),enabled:Boolean(row?.enabled)}});}

export default async function handler(req,res){const requestId=randomUUID();try{
  if(!['GET','PATCH'].includes(req.method))return send(res,405,{error:'Method not allowed.',request_id:requestId},requestId);
  const guildId=String(req.query.guild_id||'');if(!SNOWFLAKE.test(guildId))throw new HttpError(400,'Invalid Discord server ID.');
  const user=await verifyUser(bearer(req));const uid=discordUserId(user);if(!user||!SNOWFLAKE.test(uid))throw new HttpError(401,'Sign in with Discord first.');
  const guild=await authorisedGuild(String(req.headers['x-discord-provider-token']||''),guildId);
  if(!(await entitlement(uid,guildId)))return send(res,403,{error:'This server is not covered by your /premium-bot-custom grant.',request_id:requestId},requestId);

  if(req.method==='PATCH'){
    const body=req.body||{};const s=body.settings||{};
    const settingRow={
      guild_id:guildId,
      category_id:maybeSnowflake(s.category_id),log_channel_id:maybeSnowflake(s.log_channel_id),rating_channel_id:maybeSnowflake(s.rating_channel_id),verification_rating_channel_id:maybeSnowflake(s.verification_rating_channel_id)||null,staff_role_id:maybeSnowflake(s.staff_role_id),
      rating_title:text(s.rating_title,256,DEFAULT_SETTINGS.rating_title),rating_description:text(s.rating_description,1800,DEFAULT_SETTINGS.rating_description),rating_thumbnail_url:maybeUrl(s.rating_thumbnail_url,true)||null,rating_image_url:maybeUrl(s.rating_image_url)||null,rating_footer:text(s.rating_footer,256,DEFAULT_SETTINGS.rating_footer),
      ticket_panel_title:text(s.ticket_panel_title,256,DEFAULT_SETTINGS.ticket_panel_title),ticket_panel_description:text(s.ticket_panel_description,1800,DEFAULT_SETTINGS.ticket_panel_description),ticket_panel_footer:text(s.ticket_panel_footer,256,DEFAULT_SETTINGS.ticket_panel_footer),
      embed_color:HEX.test(String(s.embed_color||''))?`#${String(s.embed_color).replace('#','').toUpperCase()}`:'#FFD84D',category_overrides:s.category_overrides&&typeof s.category_overrides==='object'?s.category_overrides:{},configured_by:uid,updated_at:new Date().toISOString(),
    };
    await privateRest('tds_ticket_settings',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:settingRow});
    const support=body.panels?.support||{};const verify=body.panels?.verify||{};
    const panelRows=[
      {guild_id:guildId,panel_type:'support',title:text(support.title,256,DEFAULT_PANELS.support.title),description:text(support.description,1800,DEFAULT_PANELS.support.description),button_label:text(support.button_label,80,DEFAULT_PANELS.support.button_label),image_url:maybeUrl(support.image_url)||null,questions:questions(support.questions),button_options:panelOptions(support.button_options,['support','report'],DEFAULT_PANELS.support.button_options),configured_by:uid,updated_at:new Date().toISOString()},
      {guild_id:guildId,panel_type:'verify',title:text(verify.title,256,DEFAULT_PANELS.verify.title),description:text(verify.description,1800,DEFAULT_PANELS.verify.description),button_label:text(verify.button_label,80,DEFAULT_PANELS.verify.button_label),image_url:maybeUrl(verify.image_url)||null,questions:questions(verify.questions),button_options:panelOptions(verify.button_options,['id_verify','cross_verify'],DEFAULT_PANELS.verify.button_options),configured_by:uid,updated_at:new Date().toISOString()},
    ];
    await privateRest('tds_ticket_panels',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:panelRows});
  }

  const [settingsRows,panelRows]=await Promise.all([
    privateRest(`tds_ticket_settings?select=*&guild_id=eq.${guildId}&limit=1`),
    privateRest(`tds_ticket_panels?select=panel_type,title,description,button_label,image_url,questions,button_options&guild_id=eq.${guildId}`),
  ]);
  const settings={...DEFAULT_SETTINGS,...(settingsRows?.[0]||{})};
  const panels={support:{...DEFAULT_PANELS.support,...(panelRows||[]).find(x=>x.panel_type==='support')},verify:{...DEFAULT_PANELS.verify,...(panelRows||[]).find(x=>x.panel_type==='verify')}};
  return send(res,200,{guild:{id:guild.id,name:guild.name},entitled:true,settings,panels,request_id:requestId},requestId);
}catch(e){const status=e instanceof HttpError?e.status:500;console.error(`[ticket-config ${requestId}]`,e?.message||e);return send(res,status,{error:e instanceof Error?e.message:'Unexpected ticket configuration error.',request_id:requestId},requestId);}}