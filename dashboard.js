import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './dashboard-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const pages={overview:'Overview',profile:'My Bound Profile',servers:'Servers',safety:'Safety & Consent',moderation:'Moderation',tickets:'Tickets & Support',economy:'Economy',staff:'Staff',roleplay:'Social & RP',logs:'Audit Log',settings:'Server Settings'};
const generic={profile:['My Bound Profile','Manage your Bound identity, ownership connections and privacy controls.',[['♡','Connections','Owners, subs and relationship state'],['◉','Visibility','Choose what your profile displays'],['◆','Privacy','Data controls and deletion requests']]],servers:['Servers','Choose a Discord server to configure with Bound.',[['◇','Managed servers','Only servers you can manage are shown'],['◇','Bound installed','Servers with Bound are marked automatically'],['＋','Add a server','Invite Bound to another community']]],moderation:['Moderation','Fast staff controls, member actions and isolation workflows.',[['⌁','Actions','Ban, mute, jail and user information'],['◆','Containment','Cage and safeword workflows'],['≣','History','Auditable moderation actions']]],tickets:['Tickets & Support','Configure ticket panels, transcripts, ratings and staff claims.',[['▱','Tickets','Support and verification workflows'],['★','Ratings','Post-close staff feedback'],['♙','Staff stats','Claims, closes and ratings']]],staff:['Staff','Manage roles, assignments, clock-ins, breaks and weekly performance.',[['♙','Clocking','Active staff shifts'],['◷','Breaks','Approved staff breaks'],['◇','Assignments','Roles and temporary duties']]],roleplay:['Social & RP','Control roleplay interactions, consent defaults and social features.',[['♡','Interactions','Hug, kiss, bite, cuddle and more'],['◉','Ownership','Claims, owners and subs'],['◇','Gag system','Consent-based gag controls']]],logs:['Audit Log','Search what Bound and your staff have changed across the server.',[['≣','Moderation','Actions and reasons'],['₦','Economy','Balance adjustments and rewards'],['◆','Safety','Protected review history']]]};

const $ = (id) => document.getElementById(id);
const authGate = $('authGate');
const authDiscordBtn = $('authDiscordBtn');
const loginBtn = $('loginBtn');
const logoutBtn = $('logoutBtn');
const authMessage = $('authMessage');
const serverPicker = $('serverPicker');
const serverPickerBtn = $('serverPickerBtn');
let session = null;
let providerToken = null;
let managedGuilds = [];
let selectedGuildId = localStorage.getItem('bound_dashboard_guild') || null;
let overview = null;

const activityList=$('activityList');
if (activityList) activityList.innerHTML='<div class="empty-state">Sign in and choose a server to load live activity.</div>';
if ($('uptimeBars')) $('uptimeBars').innerHTML=Array.from({length:36},()=>'<i></i>').join('');

function buildGeneric(key){const v=generic[key];if(!v)return;const el=$(`view-${key}`);if(!el||el.dataset.ready)return;el.innerHTML=`<div class="generic-card"><span class="eyebrow">BOUND CONTROL CENTRE</span><h2>${v[0]}</h2><p>${v[1]}</p><div class="generic-feature-grid">${v[2].map(f=>`<div class="generic-feature"><span>${f[0]}</span><b>${f[1]}</b><small>${f[2]}</small></div>`).join('')}</div></div>`;el.dataset.ready='1';}
function showView(key){if(generic[key])buildGeneric(key);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(`view-${key}`)?.classList.add('active');document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===key));if($('pageTitle'))$('pageTitle').textContent=pages[key]||'Dashboard';$('sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
$('menuBtn')?.addEventListener('click',()=>$('sidebar')?.classList.toggle('open'));

function toast(title='Saved',message='Your changes were saved.'){const t=$('toast');if(!t)return;t.querySelector('b').textContent=title;t.querySelector('small').textContent=message;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2600)}
function setAuthMessage(message, isError=false){if(!authMessage)return;authMessage.textContent=message;authMessage.classList.toggle('error',isError);}
function setLoading(button, loading, label){if(!button)return;if(loading){button.dataset.label=button.textContent;button.textContent=label;button.disabled=true;}else{button.textContent=button.dataset.label||button.textContent;button.disabled=false;}}

async function signInWithDiscord(){
  try {
    setLoading(authDiscordBtn,true,'Opening Discord…');
    setLoading(loginBtn,true,'…');
    setAuthMessage('Opening Discord authorization…');
    const redirectTo = `${window.location.origin}/dashboard.html`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider:'discord',
      options:{
        scopes:'identify guilds',
        redirectTo,
      },
    });
    if(error) throw error;
  } catch(error){
    console.error(error);
    setAuthMessage(error?.message||'Could not start Discord login.',true);
    setLoading(authDiscordBtn,false);
    setLoading(loginBtn,false);
  }
}

authDiscordBtn?.addEventListener('click',signInWithDiscord);
loginBtn?.addEventListener('click',()=> session ? showView('servers') : signInWithDiscord());
logoutBtn?.addEventListener('click',async()=>{
  await supabase.auth.signOut();
  session=null;providerToken=null;managedGuilds=[];selectedGuildId=null;
  localStorage.removeItem('bound_dashboard_guild');
  renderSignedOut();
});

serverPickerBtn?.addEventListener('click',()=>{
  if(!session){signInWithDiscord();return;}
  if(!serverPicker)return;
  serverPicker.hidden=!serverPicker.hidden;
});

document.addEventListener('click',(event)=>{
  if(!serverPicker || serverPicker.hidden)return;
  if(!serverPicker.contains(event.target) && event.target!==serverPickerBtn)serverPicker.hidden=true;
});

function renderSignedOut(){
  authGate?.classList.remove('hidden');
  if(loginBtn){loginBtn.textContent='Discord Login';loginBtn.classList.remove('signed-in');loginBtn.disabled=false;}
  if($('userName'))$('userName').textContent='Not signed in';
  if($('userRole'))$('userRole').textContent='Discord account';
  if($('userAvatar')){$('userAvatar').textContent='?';$('userAvatar').style.backgroundImage='';}
  if($('serverName'))$('serverName').textContent='Choose a server';
  if(serverPicker)serverPicker.innerHTML='';
  setAuthMessage('Discord OAuth uses the identify and guilds scopes.');
}

function avatarFallback(name='B'){return String(name).trim().charAt(0).toUpperCase()||'B';}
function applyAvatar(el,url,name){if(!el)return;if(url){el.textContent='';el.style.backgroundImage=`url("${url}")`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';}else{el.style.backgroundImage='';el.textContent=avatarFallback(name);}}

async function api(action,{guildId,method='GET',body}={}){
  if(!session?.access_token) throw new Error('Your session expired. Sign in again.');
  providerToken = session.provider_token || providerToken;
  if(!providerToken) throw new Error('Discord authorization expired. Sign out and reconnect Discord.');
  const params=new URLSearchParams({action});
  if(guildId)params.set('guild_id',guildId);
  const response=await fetch(`/api/dashboard?${params.toString()}`,{
    method,
    headers:{
      'Authorization':`Bearer ${session.access_token}`,
      'X-Discord-Provider-Token':providerToken,
      ...(body?{'Content-Type':'application/json'}:{}),
    },
    body:body?JSON.stringify(body):undefined,
  });
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data.error||`Dashboard API failed (${response.status}).`);
  return data;
}

async function bootstrap(){
  try{
    const data=await api('bootstrap');
    managedGuilds=data.guilds||[];
    authGate?.classList.add('hidden');
    const user=data.user||{};
    if($('userName'))$('userName').textContent=user.display_name||user.username||'Discord user';
    if($('userRole'))$('userRole').textContent='Discord connected';
    applyAvatar($('userAvatar'),user.avatar_url,user.display_name||user.username);
    if(loginBtn){loginBtn.textContent=user.display_name||user.username||'Discord';loginBtn.classList.add('signed-in');loginBtn.disabled=false;}
    renderGuildPicker();

    if(selectedGuildId && !managedGuilds.some(g=>g.id===selectedGuildId))selectedGuildId=null;
    if(!selectedGuildId){
      const installed=managedGuilds.find(g=>g.bound_installed);
      selectedGuildId=installed?.id||managedGuilds[0]?.id||null;
    }
    if(selectedGuildId){
      await chooseGuild(selectedGuildId,false);
    } else {
      if($('serverName'))$('serverName').textContent='No manageable servers';
      toast('No servers found','Discord did not return a server you can manage.');
    }
  }catch(error){
    console.error(error);
    setAuthMessage(error?.message||'Could not load your Bound dashboard.',true);
    authGate?.classList.remove('hidden');
  }
}

function renderGuildPicker(){
  if(!serverPicker)return;
  if(!managedGuilds.length){serverPicker.innerHTML='<div class="picker-empty">No manageable servers found.</div>';return;}
  serverPicker.innerHTML=managedGuilds.map(g=>`<button class="server-option ${g.id===selectedGuildId?'active':''}" data-guild-id="${g.id}">${g.icon_url?`<img src="${g.icon_url}" alt="">`:`<span>${avatarFallback(g.name)}</span>`}<div><b>${escapeHtml(g.name)}</b><small>${g.bound_installed?'Bound installed':'Bound data not detected'}</small></div>${g.bound_installed?'<em>BOUND</em>':''}</button>`).join('');
  serverPicker.querySelectorAll('[data-guild-id]').forEach(button=>button.addEventListener('click',()=>chooseGuild(button.dataset.guildId,true)));
}

async function chooseGuild(guildId,closePicker=true){
  selectedGuildId=guildId;
  localStorage.setItem('bound_dashboard_guild',guildId);
  if(closePicker && serverPicker)serverPicker.hidden=true;
  renderGuildPicker();
  const guild=managedGuilds.find(g=>g.id===guildId);
  if(guild){
    if($('serverName'))$('serverName').textContent=guild.name;
    applyAvatar($('serverIcon'),guild.icon_url,guild.name);
  }
  await loadOverview();
}

function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function formatDate(value){if(!value)return '—';try{return new Intl.RelativeTimeFormat('en',{numeric:'auto'}).format(-Math.max(1,Math.round((Date.now()-new Date(value).getTime())/60000)),'minute');}catch{return '—';}}
function formatNugs(value){return new Intl.NumberFormat('en-GB').format(Number(value||0));}

async function loadOverview(){
  if(!selectedGuildId)return;
  try{
    if($('metricGuildStatus'))$('metricGuildStatus').textContent='…';
    overview=await api('overview',{guildId:selectedGuildId});
    const d=overview;
    if($('serverName'))$('serverName').textContent=d.guild?.name||'Server';
    applyAvatar($('serverIcon'),d.guild?.icon_url,d.guild?.name);
    if($('metricGuildStatus'))$('metricGuildStatus').textContent=d.activation?.tos_accepted?'Activated':'Setup';
    if($('metricTos'))$('metricTos').textContent=d.activation?.tos_accepted?'Terms accepted':'Terms pending';
    if($('metricVerified'))$('metricVerified').textContent=d.verification?'Yes':'No';
    if($('metricSafety'))$('metricSafety').textContent=String(d.safety?.pending??0);
    if($('metricNugs'))$('metricNugs').textContent=d.economy?.total_nugs_display||'0';
    if($('metricEconomyUsers'))$('metricEconomyUsers').textContent=String(d.economy?.users??0);
    if($('safetyOpen'))$('safetyOpen').textContent=String(d.safety?.pending??0);
    if($('safetyCages'))$('safetyCages').textContent=String(d.safety?.cages?.length??0);
    if($('safetyGags'))$('safetyGags').textContent=String(d.safety?.active_gags?.length??0);
    if($('safetyNetwork'))$('safetyNetwork').textContent=d.safety?.config?.safety_enabled?'Enabled':'Not set';
    if($('economyCirculation'))$('economyCirculation').textContent=formatNugs(d.economy?.total_nugs);
    if($('economyUsers'))$('economyUsers').textContent=String(d.economy?.users??0);
    if($('economySync'))$('economySync').textContent='Live';
    if($('prefixInput'))$('prefixInput').value=d.settings?.prefix||'£';
    if($('saveState'))$('saveState').textContent='No unsaved changes';
    renderSafetyRows(d.safety?.cases||[]);
    renderActivity(d.activity||[]);
  }catch(error){
    console.error(error);
    toast('Could not load server',error?.message||'Dashboard data failed to load.');
  }
}

function renderSafetyRows(rows){
  const el=$('safetyRows');if(!el)return;
  if(!rows.length){el.innerHTML='<div class="empty-state table-empty">No recent safety cases for this server.</div>';return;}
  el.innerHTML=rows.map(row=>`<div class="table-row"><span><i class="mini-avatar">${avatarFallback(row.reported_user_id)}</i>${escapeHtml(row.reported_user_id)}</span><span>${escapeHtml((row.requested_flag_type||'case').replaceAll('_',' '))}</span><span>${new Date(row.created_at).toLocaleDateString()}</span><span><em class="risk ${row.requested_flag_type==='minor_safety'?'high':'medium'}">${row.requested_flag_type==='minor_safety'?'HIGH':'REVIEW'}</em></span><span>${escapeHtml(row.status)}</span></div>`).join('');
}

function renderActivity(rows){
  if(!activityList)return;
  if(!rows.length){activityList.innerHTML='<div class="empty-state">No recent game activity for this server.</div>';return;}
  activityList.innerHTML=rows.map(row=>`<div class="activity-item"><span class="activity-icon">₦</span><div><b>${escapeHtml((row.activity_type||'activity').replaceAll('_',' '))}</b><small>User ${escapeHtml(row.user_id)}${Number(row.money_earned||0)?` • ${formatNugs(row.money_earned)} Nugs`:''}</small></div><small>${formatDate(row.created_at)}</small></div>`).join('');
}

$('prefixInput')?.addEventListener('input',()=>{if($('saveState'))$('saveState').textContent='Unsaved changes';});
$('saveSettings')?.addEventListener('click',async()=>{
  if(!selectedGuildId){toast('Choose a server','Select a Discord server first.');return;}
  const button=$('saveSettings');
  try{
    setLoading(button,true,'Saving…');
    const prefix=$('prefixInput')?.value||'';
    const data=await api('settings',{guildId:selectedGuildId,method:'PATCH',body:{prefix}});
    if($('prefixInput'))$('prefixInput').value=data.settings?.prefix||prefix;
    if($('saveState'))$('saveState').textContent='All changes saved';
    toast('Server settings saved','Bound will pick up the new prefix shortly.');
  }catch(error){toast('Could not save',error?.message||'The server rejected this change.');}
  finally{setLoading(button,false);}
});

supabase.auth.onAuthStateChange((event,newSession)=>{
  session=newSession;
  providerToken=newSession?.provider_token||providerToken;
  if(event==='SIGNED_OUT'||!newSession){renderSignedOut();return;}
  if(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED')bootstrap();
});

(async()=>{
  const {data:{session:initialSession},error}=await supabase.auth.getSession();
  if(error){console.error(error);setAuthMessage(error.message,true);renderSignedOut();return;}
  session=initialSession;
  providerToken=initialSession?.provider_token||null;
  if(initialSession) await bootstrap(); else renderSignedOut();
})();
