import { databaseRest } from '../server/database.js';
import { getSession, requireSameOrigin } from '../server/auth.js';

function headers(res){res.setHeader('Cache-Control','no-store, max-age=0');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');}
function send(res,status,body){headers(res);return res.status(status).json(body)}
const rest=databaseRest;
async function deletionRequestFor(uid,{pendingOnly=false}={}){if(!uid)return null;const status=pendingOnly?'&status=eq.pending':'';const rows=await rest(`data_deletion_requests?select=id,status,requested_at,reviewed_at,source&user_id=eq.${encodeURIComponent(uid)}${status}&order=requested_at.desc&limit=1`);return rows?.[0]||null}
function duration(s){s=Number(s||0);const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);return [d&&`${d}d`,h&&`${h}h`,m&&`${m}m`].filter(Boolean).join(' ')||`${s}s`}
function achievement(name,description,current,target,unit){const unlocked=Number(current)>=target;return{name,description,current:Number(current||0),target,unit:unit||null,unlocked,progress:Math.min(100,Math.floor((Number(current||0)/target)*100))}}
async function bdsmData(uid){
 const [pRows,gRows,oRows,sRows,rpRows]=await Promise.all([
  rest(`ownership_profiles?select=user_id,username,display_name,avatar_url,role_preference,subscription_tier,bdsm_level,bdsm_xp,bdsm_lifetime_xp&user_id=eq.${uid}&limit=1`),
  rest(`bdsm_gag_user_stats?select=*&user_id=eq.${uid}&limit=1`),
  rest(`ownership_relationships?select=owner_id,sub_id,bond_xp,status,created_at&sub_id=eq.${uid}`),
  rest(`ownership_relationships?select=owner_id,sub_id,bond_xp,status,created_at&owner_id=eq.${uid}`),
  rest(`rp_action_counts?select=action,actor_user_id,target_user_id,count&or=(actor_user_id.eq.${uid},target_user_id.eq.${uid})`),
 ]);
 const p=pRows?.[0]||{},g=gRows?.[0]||{};const owners=(oRows||[]).filter(x=>x.owner_id&&x.owner_id!==uid),subs=(sRows||[]).filter(x=>x.sub_id&&x.sub_id!==uid);const bonds=[...owners,...subs].map(x=>Number(x.bond_xp||0));const totalBond=bonds.reduce((a,b)=>a+b,0),highestBond=bonds.length?Math.max(...bonds):0;const gagTimes=Number(g.total_times_gagged||0),gagMessages=Number(g.total_messages_converted||0),totalGagSeconds=Number(g.total_gag_seconds||0),longestGagSeconds=Number(g.longest_gag_seconds||0);
 const achievements=[achievement('First Gag','get gagged for the first time',gagTimes,1),achievement('Getting Used To It','get gagged 10 times',gagTimes,10),achievement('Gag Regular','get gagged 50 times',gagTimes,50),achievement('Mmph','have 25 messages changed while gagged',gagMessages,25),achievement('Quiet One','have 100 messages changed while gagged',gagMessages,100),achievement('Timed Gag','complete a gag lasting at least 5 minutes',longestGagSeconds,300,'time'),achievement('Long Session','complete a gag lasting at least 1 hour',longestGagSeconds,3600,'time'),achievement('Time Served','spend 24 hours gagged in total',totalGagSeconds,86400,'time'),achievement('Owned','have your first owner',owners.length,1),achievement('Owner','claim your first sub',subs.length,1),achievement('Bound Together','reach 1000 bond xp across your relationships',totalBond,1000),achievement('Strong Bond','reach 5000 bond xp with one relationship',highestBond,5000)];
 const rp={};for(const row of rpRows||[]){rp[row.action]=(rp[row.action]||0)+Number(row.count||0)}
 return{profile:{user_id:uid,display_name:p.display_name||p.username||uid,username:p.username||uid,avatar_url:p.avatar_url||null,role_preference:p.role_preference||'unspecified',subscription_tier:p.subscription_tier||'free',bdsm_level:Number(p.bdsm_level||1),bdsm_xp:Number(p.bdsm_xp||0),bdsm_lifetime_xp:Number(p.bdsm_lifetime_xp||0)},stats:{owners:owners.length,subs:subs.length,total_bond:totalBond,highest_bond:highestBond,gag_times:gagTimes,gag_messages:gagMessages,total_gag_seconds:totalGagSeconds,longest_gag_seconds:longestGagSeconds,total_gag_time:duration(totalGagSeconds),longest_gag_time:duration(longestGagSeconds),rp_total:Object.values(rp).reduce((a,b)=>a+b,0),rp},achievements,achievement_summary:{unlocked:achievements.filter(x=>x.unlocked).length,total:achievements.length,completion:Math.floor((achievements.filter(x=>x.unlocked).length/achievements.length)*100)}}
}

export default async function handler(req,res){try{
 headers(res);
 if(req.method!=='GET')requireSameOrigin(req);
 const session=getSession(req);if(!session)return send(res,401,{error:'Sign in first.'});
 const uid=session.discordUserId;
 const action=String(req.query.action||'me');
 if(action==='me'&&req.method==='GET'){const deletionRequest=await deletionRequestFor(uid);return send(res,200,{discord_connected:true,discord_user_id:uid,deletion_request:deletionRequest})}
 if(action==='deletion'&&req.method==='POST'){const existing=await deletionRequestFor(uid,{pendingOnly:true});if(existing)return send(res,200,{created:false,request:existing});try{const rows=await rest('data_deletion_requests',{method:'POST',body:{user_id:uid,source:'website'}});return send(res,201,{created:true,request:rows?.[0]||null})}catch(e){if(e.status===409){const pending=await deletionRequestFor(uid,{pendingOnly:true});if(pending)return send(res,200,{created:false,request:pending})}throw e}}
 if(action==='bdsm'&&req.method==='GET'){return send(res,200,await bdsmData(uid))}
 return send(res,405,{error:'Unsupported account action.'})
}catch(e){console.error('Bound account API:',e);const status=e?.status&&Number.isInteger(e.status)?e.status:500;return send(res,status,{error:e.message||'Account request failed.'})}}
