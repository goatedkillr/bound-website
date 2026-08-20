import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './dashboard-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const $ = (id) => document.getElementById(id);
const pages = {overview:'Overview',profile:'My Bound Profile',servers:'Servers',safety:'Safety & Consent',moderation:'Moderation',tickets:'Tickets & Support',economy:'Economy',staff:'Staff',roleplay:'Social & RP',logs:'Audit Log',settings:'Server Settings'};
const generic = {
  profile:['My Bound Profile','Your Bound identity and relationship controls live primarily in Discord right now.',[['♡','Connections','Owners, subs and relationship state'],['◉','Visibility','Profile visibility remains Discord-controlled'],['◆','Privacy','Deletion requests remain protected']]],
  servers:['Servers','Choose a Discord server you own or can manage.',[['◇','Managed servers','Only servers Discord says you can manage appear'],['◇','Bound detected','Installed servers are marked automatically'],['＋','Add a server','Use the Add Bound link on the main site']]],
  moderation:['Moderation','Live moderation actions remain Discord-side for safety. Dashboard controls will only be enabled when backed by audited server APIs.',[['⌁','Actions','Ban, mute, jail and user information'],['◆','Containment','Cage and safeword workflows'],['≣','History','Auditable moderation actions']]],
  tickets:['Tickets & Support','Ticket management is currently view/configuration-ready but not directly actionable from the website yet.',[['▱','Tickets','Support and verification workflows'],['★','Ratings','Post-close staff feedback'],['♙','Staff stats','Claims, closes and ratings']]],
  staff:['Staff','Staff actions remain Discord-side until dedicated dashboard permission tables are added.',[['♙','Clocking','Active staff shifts'],['◷','Breaks','Approved staff breaks'],['◇','Assignments','Roles and temporary duties']]],
  roleplay:['Social & RP','Live social data is shared through Supabase while sensitive actions remain in Discord.',[['♡','Interactions','Hug, kiss, bite, cuddle and more'],['◉','Ownership','Claims, owners and subs'],['◇','Gag system','Consent-based gag controls']]],
  logs:['Audit Log','Recent game activity is loaded on Overview. Full cross-system audit search is the next dashboard module.',[['≣','Moderation','Actions and reasons'],['₦','Economy','Balance activity'],['◆','Safety','Protected review history']]],
};

let session = null;
let providerToken = sessionStorage.getItem('bound_discord_provider_token') || null;
let managedGuilds = [];
let selectedGuildId = localStorage.getItem('bound_dashboard_guild') || null;
let overview = null;

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function avatarFallback(name='B'){return String(name).trim().charAt(0).toUpperCase() || 'B';}
function applyAvatar(el,url,name){if(!el)return;if(url){el.textContent='';el.style.backgroundImage=`url("${url}")`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';}else{el.style.backgroundImage='';el.textContent=avatarFallback(name);}}
function formatNugs(value){return new Intl.NumberFormat('en-GB').format(Number(value||0));}
function relativeTime(value){if(!value)return '—';const ms=Date.now()-new Date(value).getTime();const mins=Math.max(1,Math.round(ms/60000));if(mins<60)return `${mins}m`;const hrs=Math.round(mins/60);if(hrs<24)return `${hrs}h`;return `${Math.round(hrs/24)}d`;}

function toast(title='Saved',message='Your changes were saved.'){
  const t=$('toast'); if(!t)return;
  t.querySelector('b').textContent=title; t.querySelector('small').textContent=message;
  t.classList.add('show'); clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),2800);
}
function setAuthMessage(message,isError=false){const el=$('authMessage');if(!el)return;el.textContent=message;el.classList.toggle('error',isError);}
function setLoading(button,loading,label='Loading…'){if(!button)return;if(loading){button.dataset.oldLabel=button.textContent;button.textContent=label;button.disabled=true;}else{button.textContent=button.dataset.oldLabel||button.textContent;button.disabled=false;}}

function buildGeneric(key){const v=generic[key];if(!v)return;const el=$(`view-${key}`);if(!el||el.dataset.ready)return;el.innerHTML=`<div class="generic-card"><span class="eyebrow">BOUND CONTROL CENTRE</span><h2>${escapeHtml(v[0])}</h2><p>${escapeHtml(v[1])}</p><div class="generic-feature-grid">${v[2].map(f=>`<div class="generic-feature"><span>${f[0]}</span><b>${escapeHtml(f[1])}</b><small>${escapeHtml(f[2])}</small></div>`).join('')}</div></div>`;el.dataset.ready='1';}
function showView(key){if(generic[key])buildGeneric(key);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(`view-${key}`)?.classList.add('active');document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===key));if($('pageTitle'))$('pageTitle').textContent=pages[key]||'Dashboard';$('sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});}

document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
$('menuBtn')?.addEventListener('click',()=>$('sidebar')?.classList.toggle('open'));
if($('uptimeBars')) $('uptimeBars').innerHTML=Array.from({length:36},()=>'<i></i>').join('');
if($('activityList')) $('activityList').innerHTML='<div class="empty-state">Sign in and choose a server to load live activity.</div>';

async function signInWithDiscord(){
  try{
    setLoading($('authDiscordBtn'),true,'Opening Discord…');
    setLoading($('loginBtn'),true,'…');
    setAuthMessage('Opening Discord authorization…');
    const { error } = await supabase.auth.signInWithOAuth({provider:'discord',options:{scopes:'identify guilds',redirectTo:`${window.location.origin}/dashboard.html`}});
    if(error) throw error;
  }catch(error){
    console.error(error); setAuthMessage(error?.message||'Could not start Discord login.',true);
    setLoading($('authDiscordBtn'),false); setLoading($('loginBtn'),false);
  }
}

$('authDiscordBtn')?.addEventListener('click',signInWithDiscord);
$('loginBtn')?.addEventListener('click',()=>session ? toggleServerPicker() : signInWithDiscord());
$('logoutBtn')?.addEventListener('click',async()=>{await supabase.auth.signOut();sessionStorage.removeItem('bound_discord_provider_token');localStorage.removeItem('bound_dashboard_guild');session=null;providerToken=null;managedGuilds=[];selectedGuildId=null;renderSignedOut();});

function renderSignedOut(){
  $('authGate')?.classList.remove('hidden');
  if($('loginBtn')){$('loginBtn').textContent='Discord Login';$('loginBtn').classList.remove('signed-in');$('loginBtn').disabled=false;}
  if($('userName'))$('userName').textContent='Not signed in'; if($('userRole'))$('userRole').textContent='Discord account'; applyAvatar($('userAvatar'),null,'?');
  if($('serverName'))$('serverName').textContent='Choose a server'; if($('serverPicker'))$('serverPicker').innerHTML='';
  setAuthMessage('Sign in with Discord to load servers you can manage.');
}

async function api(action,{guildId,method='GET',body}={}){
  if(!session?.access_token) throw new Error('Your Supabase session expired. Sign in again.');
  if(!providerToken) throw new Error('Discord server access expired. Sign out and reconnect Discord.');
  const q=new URLSearchParams({action}); if(guildId)q.set('guild_id',guildId);
  const response=await fetch(`/api/dashboard?${q.toString()}`,{method,headers:{Authorization:`Bearer ${session.access_token}`,'X-Discord-Provider-Token':providerToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  let data={}; try{data=await response.json();}catch{}
  if(!response.ok) throw new Error(data.error||`Dashboard API failed (${response.status}).`);
  return data;
}

async function bootstrap(){
  try{
    setAuthMessage('Loading your manageable servers…');
    const data=await api('bootstrap');
    managedGuilds=data.guilds||[];
    const user=data.user||{};
    $('authGate')?.classList.add('hidden');
    if($('userName'))$('userName').textContent=user.display_name||user.username||'Discord user'; if($('userRole'))$('userRole').textContent='Discord connected'; applyAvatar($('userAvatar'),user.avatar_url,user.display_name||user.username);
    if($('loginBtn')){$('loginBtn').textContent=user.display_name||user.username||'Discord';$('loginBtn').classList.add('signed-in');$('loginBtn').disabled=false;}
    renderGuildPicker();
    if(selectedGuildId && !managedGuilds.some(g=>g.id===selectedGuildId)) selectedGuildId=null;
    if(!selectedGuildId) selectedGuildId=(managedGuilds.find(g=>g.bound_installed)||managedGuilds[0])?.id||null;
    if(selectedGuildId) await chooseGuild(selectedGuildId,false); else {if($('serverName'))$('serverName').textContent='No manageable servers';toast('No servers found','Discord returned no server you can manage.');}
  }catch(error){
    console.error(error);
    setAuthMessage(error?.message||'Could not load dashboard.',true);
    // Keep the login gate visible only when authentication itself needs action.
    $('authGate')?.classList.remove('hidden');
  }
}

function renderGuildPicker(){
  const picker=$('serverPicker');if(!picker)return;
  if(!managedGuilds.length){picker.innerHTML='<div class="picker-empty">No manageable servers found.</div>';return;}
  picker.innerHTML=managedGuilds.map(g=>`<button class="server-option ${g.id===selectedGuildId?'active':''}" data-guild-id="${g.id}">${g.icon_url?`<img src="${g.icon_url}" alt="">`:`<span>${avatarFallback(g.name)}</span>`}<div><b>${escapeHtml(g.name)}</b><small>${g.bound_installed?'Bound detected':'Bound data not detected'}</small></div>${g.bound_installed?'<em>BOUND</em>':''}</button>`).join('');
  picker.querySelectorAll('[data-guild-id]').forEach(b=>b.addEventListener('click',()=>chooseGuild(b.dataset.guildId,true)));
}
function toggleServerPicker(){const p=$('serverPicker');if(!p)return;p.hidden=!p.hidden;}
$('serverPickerBtn')?.addEventListener('click',()=>session?toggleServerPicker():signInWithDiscord());
document.addEventListener('click',(e)=>{const p=$('serverPicker');if(!p||p.hidden)return;if(!p.contains(e.target)&&e.target!==$('serverPickerBtn')&&e.target!==$('loginBtn'))p.hidden=true;});

async function chooseGuild(guildId,close=true){
  selectedGuildId=guildId;localStorage.setItem('bound_dashboard_guild',guildId);if(close&&$('serverPicker'))$('serverPicker').hidden=true;renderGuildPicker();
  const g=managedGuilds.find(x=>x.id===guildId);if(g){if($('serverName'))$('serverName').textContent=g.name;applyAvatar($('serverIcon'),g.icon_url,g.name);}
  await loadOverview();
}

async function loadOverview(){
  if(!selectedGuildId)return;
  try{
    if($('metricGuildStatus'))$('metricGuildStatus').textContent='…';
    overview=await api('overview',{guildId:selectedGuildId}); const d=overview;
    if($('serverName'))$('serverName').textContent=d.guild?.name||'Server';applyAvatar($('serverIcon'),d.guild?.icon_url,d.guild?.name);
    if($('metricGuildStatus'))$('metricGuildStatus').textContent=d.activation?.tos_accepted?'Activated':'Setup';
    if($('metricTos'))$('metricTos').textContent=d.activation?.tos_accepted?'Terms accepted':'Terms pending';
    if($('metricVerified'))$('metricVerified').textContent=d.verification?'Yes':'No';
    if($('metricSafety'))$('metricSafety').textContent=String(d.safety?.pending??0);
    if($('metricNugs'))$('metricNugs').textContent=d.economy?.total_nugs_display||'0'; if($('metricEconomyUsers'))$('metricEconomyUsers').textContent=String(d.economy?.users??0);
    if($('safetyOpen'))$('safetyOpen').textContent=String(d.safety?.pending??0); if($('safetyCages'))$('safetyCages').textContent=String(d.safety?.cages?.length??0); if($('safetyGags'))$('safetyGags').textContent=String(d.safety?.active_gags?.length??0); if($('safetyNetwork'))$('safetyNetwork').textContent=d.safety?.config?.safety_enabled?'Enabled':'Not set';
    if($('economyCirculation'))$('economyCirculation').textContent=formatNugs(d.economy?.total_nugs); if($('economyUsers'))$('economyUsers').textContent=String(d.economy?.users??0); if($('economySync'))$('economySync').textContent='Live';
    if($('prefixInput'))$('prefixInput').value=d.settings?.prefix||'£'; if($('saveState'))$('saveState').textContent='No unsaved changes';
    renderSafetyRows(d.safety?.cases||[]); renderActivity(d.activity||[]);
  }catch(error){console.error(error);toast('Live data unavailable',error?.message||'Could not load this server.');if($('metricGuildStatus'))$('metricGuildStatus').textContent='Error';}
}

function renderSafetyRows(rows){const el=$('safetyRows');if(!el)return;if(!rows.length){el.innerHTML='<div class="empty-state table-empty">No recent safety cases for this server.</div>';return;}el.innerHTML=rows.map(r=>`<div class="table-row"><span><i class="mini-avatar">${avatarFallback(r.reported_user_id)}</i>${escapeHtml(r.reported_user_id)}</span><span>${escapeHtml((r.requested_flag_type||'case').replaceAll('_',' '))}</span><span>${r.created_at?new Date(r.created_at).toLocaleDateString():'—'}</span><span><em class="risk ${r.requested_flag_type==='minor_safety'?'high':'medium'}">${r.requested_flag_type==='minor_safety'?'HIGH':'REVIEW'}</em></span><span>${escapeHtml(r.status||'unknown')}</span></div>`).join('');}
function renderActivity(rows){const el=$('activityList');if(!el)return;if(!rows.length){el.innerHTML='<div class="empty-state">No recent game activity for this server.</div>';return;}el.innerHTML=rows.map(r=>`<div class="activity-item"><span class="activity-icon">₦</span><div><b>${escapeHtml((r.activity_type||'activity').replaceAll('_',' '))}</b><small>User ${escapeHtml(r.user_id)}${Number(r.money_earned||0)?` • ${formatNugs(r.money_earned)} Nugs`:''}</small></div><small>${relativeTime(r.created_at)}</small></div>`).join('');}

$('prefixInput')?.addEventListener('input',()=>{if($('saveState'))$('saveState').textContent='Unsaved changes';});
$('saveSettings')?.addEventListener('click',async()=>{
  if(!selectedGuildId){toast('Choose a server','Select a server first.');return;}
  const btn=$('saveSettings');
  try{setLoading(btn,true,'Saving…');const prefix=$('prefixInput')?.value||'';const data=await api('settings',{guildId:selectedGuildId,method:'PATCH',body:{prefix}});if($('prefixInput'))$('prefixInput').value=data.settings?.prefix||prefix;if($('saveState'))$('saveState').textContent='All changes saved';toast('Server settings saved','Bound will pick up the new prefix shortly.');}
  catch(error){toast('Could not save',error?.message||'Server rejected this change.');}
  finally{setLoading(btn,false);}
});

// Disabled placeholder controls remain inert by design; never toggle them visually.
document.querySelectorAll('.switch:not(:disabled)').forEach(s=>s.addEventListener('click',()=>s.classList.toggle('on')));

supabase.auth.onAuthStateChange((event,newSession)=>{
  session=newSession;
  if(newSession?.provider_token){providerToken=newSession.provider_token;sessionStorage.setItem('bound_discord_provider_token',providerToken);}
  if(event==='SIGNED_OUT'){sessionStorage.removeItem('bound_discord_provider_token');providerToken=null;renderSignedOut();}
});

(async()=>{
  const { data:{session:existing}, error } = await supabase.auth.getSession();
  if(error){console.error(error);renderSignedOut();return;}
  session=existing;
  if(existing?.provider_token){providerToken=existing.provider_token;sessionStorage.setItem('bound_discord_provider_token',providerToken);}
  if(session){if(providerToken) await bootstrap(); else {renderSignedOut();setAuthMessage('Your Supabase session exists, but Discord server access expired. Sign out and reconnect Discord.',true);}}
  else renderSignedOut();
})();
