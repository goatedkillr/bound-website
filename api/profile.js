import { databaseConfigured, databaseRest } from '../server/database.js';
import { getSession } from '../server/auth.js';

function send(res,status,body){res.setHeader('Cache-Control','private, no-store');return res.status(status).json(body)}
function discordAvatarUrl(userId,avatarHash){return avatarHash?`https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${avatarHash.startsWith('a_')?'gif':'png'}`:null}
const rest=databaseRest;
async function safe(fn,f=[]){try{return await fn()}catch(e){console.error(e);return f}}
export default async function handler(req,res){try{
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
 if(!databaseConfigured())return send(res,503,{error:'Missing Railway DATABASE_URL.'});
 const session=getSession(req);if(!session)return send(res,401,{error:'Sign in first.'});
 const uid=session.discordUserId;
 const [profiles,relationships,gagStats,activeGags,rpGiven,rpReceived,gagPairs,cache]=await Promise.all([
  safe(()=>rest(`ownership_profiles?select=*&user_id=eq.${uid}`)),
  safe(()=>rest(`ownership_relationships?select=*&or=(owner_id.eq.${uid},sub_id.eq.${uid})&status=eq.active&order=updated_at.desc`)),
  safe(()=>rest(`bdsm_gag_user_stats?select=*&user_id=eq.${uid}`)),
  safe(()=>rest(`bdsm_active_gags?select=*&gagged_user_id=eq.${uid}&active=eq.true&order=started_at.desc&limit=1`)),
  safe(()=>rest(`rp_action_counts?select=action,target_user_id,count&actor_user_id=eq.${uid}`)),
  safe(()=>rest(`rp_action_counts?select=action,actor_user_id,count&target_user_id=eq.${uid}`)),
  safe(()=>rest(`bdsm_gag_pair_stats?select=owner_id,sub_id,total_gags&or=(owner_id.eq.${uid},sub_id.eq.${uid})`)),
  safe(()=>rest(`bdsm_discord_user_cache?select=user_id,display_name,avatar_url`)),
 ]);
 const p=profiles[0]||{};const cm=new Map(cache.map(x=>[x.user_id,x]));
 // interactions/gag_count used to read ownership_relationships.interactions_count/
 // gag_count directly - neither column exists on that table, so both always read
 // as 0. Real per-partner data lives elsewhere: RP interaction totals are already
 // fetched above (rpGiven/rpReceived just weren't split out per partner), and gag
 // counts live in the separate bdsm_gag_pair_stats table keyed by (owner_id,sub_id).
 const gagPairMap=new Map(gagPairs.map(g=>[`${g.owner_id}:${g.sub_id}`,Number(g.total_gags||0)]));
 const rels=relationships.map(r=>{const otherId=r.owner_id===uid?r.sub_id:r.owner_id;const other=cm.get(otherId)||{};const interactions=rpGiven.filter(x=>x.target_user_id===otherId).reduce((s,x)=>s+Number(x.count||0),0)+rpReceived.filter(x=>x.actor_user_id===otherId).reduce((s,x)=>s+Number(x.count||0),0);return{relationship_id:r.relationship_id,role:r.owner_id===uid?'owner':'sub',other_user_id:otherId,other_name:other.display_name||otherId,other_avatar:other.avatar_url||null,relationship_name:r.relationship_name||null,bond_level:r.bond_level||0,bond_xp:Number(r.bond_xp||0),interactions,gag_count:gagPairMap.get(`${r.owner_id}:${r.sub_id}`)||0,currently_gagged:Boolean(r.currently_gagged),claimed_at:r.claimed_at}});
 const aggregate=(rows)=>{const out={};for(const r of rows)out[r.action]=(out[r.action]||0)+Number(r.count||0);return out};
 const given=aggregate(rpGiven),received=aggregate(rpReceived);const allActions=[...new Set([...Object.keys(given),...Object.keys(received)])];
 const rp=allActions.map(action=>({action,given:given[action]||0,received:received[action]||0,total:(given[action]||0)+(received[action]||0)})).sort((a,b)=>b.total-a.total);
 return send(res,200,{user:{id:uid,username:p.username||session.name||'',display_name:p.display_name||session.name||'Bound user',avatar_url:p.avatar_url||discordAvatarUrl(uid,session.avatar),banner_url:p.banner_url||null,accent_color:p.accent_color||null,custom_title:p.custom_title||null,bio:p.bio||null,role_preference:p.role_preference||null,subscription_tier:p.subscription_tier||null,bdsm_level:p.bdsm_level||1,bdsm_xp:Number(p.bdsm_xp||0),bdsm_lifetime_xp:Number(p.bdsm_lifetime_xp||0),looking_for_owner:Boolean(p.looking_for_owner),looking_for_sub:Boolean(p.looking_for_sub),profile_visible:p.profile_visible!==false},relationships:rels,gag_stats:gagStats[0]||null,active_gag:activeGags[0]||null,rp_actions:rp,totals:{relationships:rels.length,owners:rels.filter(r=>r.role==='sub').length,subs:rels.filter(r=>r.role==='owner').length,rp_given:rp.reduce((s,r)=>s+r.given,0),rp_received:rp.reduce((s,r)=>s+r.received,0)}})
}catch(e){console.error(e);return send(res,500,{error:e instanceof Error?e.message:'Profile load failed.'})}}
