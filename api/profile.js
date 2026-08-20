const SUPABASE_URL=process.env.SUPABASE_URL||'https://hpbqoochibnrxzxeuazb.supabase.co';
const PUBLISHABLE=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE=process.env.SUPABASE_SERVICE_ROLE_KEY;
function send(res,status,body){res.setHeader('Cache-Control','private, no-store');return res.status(status).json(body)}
function bearer(req){const v=req.headers.authorization||'';return v.startsWith('Bearer ')?v.slice(7):null}
async function userFor(token){if(!token)return null;const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:PUBLISHABLE,Authorization:`Bearer ${token}`}});return r.ok?r.json():null}
function discordId(u){return String(u?.user_metadata?.provider_id||u?.user_metadata?.sub||u?.identities?.[0]?.identity_data?.sub||'')}
async function rest(path){const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`}});const text=await r.text();let d=[];try{d=text?JSON.parse(text):[]}catch{}if(!r.ok)throw new Error(d?.message||`Supabase ${r.status}`);return d}
async function safe(fn,f=[]){try{return await fn()}catch(e){console.error(e);return f}}
export default async function handler(req,res){try{
 if(req.method!=='GET')return send(res,405,{error:'Method not allowed.'});
 if(!SERVICE)return send(res,500,{error:'Missing SUPABASE_SERVICE_ROLE_KEY.'});
 const authUser=await userFor(bearer(req));if(!authUser)return send(res,401,{error:'Sign in first.'});
 const uid=discordId(authUser);if(!uid)return send(res,400,{error:'Discord identity unavailable.'});
 const [profiles,relationships,gagStats,activeGags,rpGiven,rpReceived,cache]=await Promise.all([
  safe(()=>rest(`ownership_profiles?select=*&user_id=eq.${uid}`)),
  safe(()=>rest(`ownership_relationships?select=*&or=(owner_id.eq.${uid},sub_id.eq.${uid})&status=eq.active&order=updated_at.desc`)),
  safe(()=>rest(`bdsm_gag_user_stats?select=*&user_id=eq.${uid}`)),
  safe(()=>rest(`bdsm_active_gags?select=*&gagged_user_id=eq.${uid}&active=eq.true&order=started_at.desc&limit=1`)),
  safe(()=>rest(`rp_action_counts?select=action,target_user_id,count&actor_user_id=eq.${uid}`)),
  safe(()=>rest(`rp_action_counts?select=action,actor_user_id,count&target_user_id=eq.${uid}`)),
  safe(()=>rest(`bdsm_discord_user_cache?select=user_id,display_name,avatar_url`)),
 ]);
 const p=profiles[0]||{};const cm=new Map(cache.map(x=>[x.user_id,x]));
 const rels=relationships.map(r=>{const otherId=r.owner_id===uid?r.sub_id:r.owner_id;const other=cm.get(otherId)||{};return{relationship_id:r.relationship_id,role:r.owner_id===uid?'owner':'sub',other_user_id:otherId,other_name:other.display_name||otherId,other_avatar:other.avatar_url||null,relationship_name:r.relationship_name||null,bond_level:r.bond_level||0,bond_xp:Number(r.bond_xp||0),interactions:Number(r.interactions_count||0),gag_count:Number(r.gag_count||0),currently_gagged:Boolean(r.currently_gagged),claimed_at:r.claimed_at}});
 const aggregate=(rows)=>{const out={};for(const r of rows)out[r.action]=(out[r.action]||0)+Number(r.count||0);return out};
 const given=aggregate(rpGiven),received=aggregate(rpReceived);const allActions=[...new Set([...Object.keys(given),...Object.keys(received)])];
 const rp=allActions.map(action=>({action,given:given[action]||0,received:received[action]||0,total:(given[action]||0)+(received[action]||0)})).sort((a,b)=>b.total-a.total);
 return send(res,200,{user:{id:uid,username:p.username||authUser.user_metadata?.user_name||'',display_name:p.display_name||authUser.user_metadata?.full_name||authUser.user_metadata?.name||authUser.user_metadata?.user_name||'Bound user',avatar_url:p.avatar_url||authUser.user_metadata?.avatar_url||authUser.user_metadata?.picture||null,banner_url:p.banner_url||null,accent_color:p.accent_color||null,custom_title:p.custom_title||null,bio:p.bio||null,role_preference:p.role_preference||null,subscription_tier:p.subscription_tier||null,bdsm_level:p.bdsm_level||1,bdsm_xp:Number(p.bdsm_xp||0),bdsm_lifetime_xp:Number(p.bdsm_lifetime_xp||0),looking_for_owner:Boolean(p.looking_for_owner),looking_for_sub:Boolean(p.looking_for_sub),profile_visible:p.profile_visible!==false},relationships:rels,gag_stats:gagStats[0]||null,active_gag:activeGags[0]||null,rp_actions:rp,totals:{relationships:rels.length,owners:rels.filter(r=>r.role==='sub').length,subs:rels.filter(r=>r.role==='owner').length,rp_given:rp.reduce((s,r)=>s+r.given,0),rp_received:rp.reduce((s,r)=>s+r.received,0)}})
}catch(e){console.error(e);return send(res,500,{error:e instanceof Error?e.message:'Profile load failed.'})}}
