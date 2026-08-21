import { supabase, authReady, isAuthCallback, getStoredProviderToken, ensureFreshProviderToken, refreshProviderToken, clearProviderTokens } from './supabase-client.js';

const $=id=>document.getElementById(id);
const pages={overview:'Overview',profile:'My Bound Profile',servers:'Servers',safety:'Safety & Consent',moderation:'Moderation',tickets:'Tickets & Support',economy:'Factions',staff:'Staff',roleplay:'Social & RP',logs:'Audit Log',settings:'Server Settings'};
const generic={
 profile:['My Bound Profile','Your Bound identity and relationship controls live primarily in Discord right now.',[['♡','Connections','Owners, subs and relationship state'],['◉','Visibility','Profile visibility remains Discord-controlled'],['◆','Privacy','Deletion requests remain protected']]],
 servers:['Servers','Choose a Discord server you own or can manage.',[['◇','Managed servers','Only servers Discord says you can manage appear'],['◇','Faction approval','Each approved Discord server becomes its own faction'],['＋','Add a server','Use the Add Bound link on the main site']]],
 moderation:['Moderation','Live moderation actions remain Discord-side for safety.',[['⌁','Actions','Ban, mute, jail and user information'],['◆','Containment','Cage and safeword workflows'],['≣','History','Auditable moderation actions']]],
 tickets:['Tickets & Support','Ticket management remains primarily Discord-side.',[['▱','Tickets','Support and verification workflows'],['★','Ratings','Post-close staff feedback'],['♙','Staff stats','Claims, closes and ratings']]],
 roleplay:['Social & RP','Ownership, gagging and social systems share the same Supabase backend.',[['♡','Interactions','Hug, kiss, bite, cuddle and more'],['◉','Ownership','Claims, owners and subs'],['◇','Gag system','Consent-based gag controls']]],
 logs:['Audit Log','Recent activity is loaded on Overview. Full audit search is the next dashboard module.',[['≣','Moderation','Actions and reasons'],['⛓','Factions','Bonds and faction activity'],['◆','Safety','Protected review history']]],
};
let session=null,providerToken=getStoredProviderToken()||null,managedGuilds=[],selectedGuildId=localStorage.getItem('bound_dashboard_guild')||null,overview=null,bootstrapRunning=false;
const permissionLabels={manage_settings:'Server settings',manage_safety:'Safety controls',manage_factions:'Faction controls'};

function escapeHtml(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function avatarFallback(v='B'){return String(v).trim().charAt(0).toUpperCase()||'B';}
function applyAvatar(el,url,name){if(!el)return;if(url){el.textContent='';el.style.backgroundImage=`url("${url}")`;el.style.backgroundSize='cover';el.style.backgroundPosition='center';}else{el.style.backgroundImage='';el.textContent=avatarFallback(name);}}
function applyServerIcon(el,url,name){if(!el)return;el.innerHTML='';el.style.backgroundImage='';if(url){const img=document.createElement('img');img.src=url;img.alt=`${name||'Server'} icon`;img.style.cssText='width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit';img.onerror=()=>{el.innerHTML='';el.textContent=avatarFallback(name)};el.appendChild(img)}else el.textContent=avatarFallback(name);}
function fmt(v){return new Intl.NumberFormat('en-GB').format(Number(v||0));}
function relativeTime(v){if(!v)return'—';const m=Math.max(1,Math.round((Date.now()-new Date(v).getTime())/60000));if(m<60)return`${m}m`;const h=Math.round(m/60);return h<24?`${h}h`:`${Math.round(h/24)}d`;}
function toast(title='Saved',message='Your changes were saved.'){const t=$('toast');if(!t)return;t.querySelector('b').textContent=title;t.querySelector('small').textContent=message;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2800);}
function setLoading(btn,on,label='Loading…'){if(!btn)return;if(on){btn.dataset.oldLabel=btn.textContent;btn.textContent=label;btn.disabled=true}else{btn.textContent=btn.dataset.oldLabel||btn.textContent;btn.disabled=false}}
function setSwitchState(btn,state){if(!btn)return;btn.classList.toggle('on',!!state);btn.setAttribute('aria-pressed',String(!!state));}

function buildGeneric(key){const v=generic[key],el=$(`view-${key}`);if(!v||!el||el.dataset.ready||el.dataset.finished==='1')return;el.innerHTML=`<div class="generic-card"><span class="eyebrow">BOUND CONTROL CENTRE</span><h2>${escapeHtml(v[0])}</h2><p>${escapeHtml(v[1])}</p><div class="generic-feature-grid">${v[2].map(f=>`<div class="generic-feature"><span>${f[0]}</span><b>${escapeHtml(f[1])}</b><small>${escapeHtml(f[2])}</small></div>`).join('')}</div></div>`;el.dataset.ready='1';}
function setSidebarOpen(open){const sidebar=$('sidebar'),menu=$('menuBtn'),backdrop=$('sidebarBackdrop');sidebar?.classList.toggle('open',open);backdrop?.classList.toggle('open',open);document.body.classList.toggle('sidebar-open',open);menu?.classList.toggle('is-open',open);menu?.setAttribute('aria-expanded',String(open));if(menu){menu.setAttribute('aria-label',open?'Close dashboard menu':'Open dashboard menu');const icon=menu.querySelector('span');if(icon)icon.textContent=open?'×':'☰';}}
function showView(key){if(currentGuild()?.faction_only&&!['economy','account'].includes(key))key='economy';if(generic[key])buildGeneric(key);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));$(`view-${key}`)?.classList.add('active');document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.view===key));if($('pageTitle'))$('pageTitle').textContent=pages[key]||'Dashboard';if(key==='settings'&&currentGuild()?.owner)void loadPermissionGrants();setSidebarOpen(false);window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.jump)));
$('menuBtn')?.addEventListener('click',()=>setSidebarOpen(!$('sidebar')?.classList.contains('open')));
$('sidebarCloseBtn')?.addEventListener('click',()=>setSidebarOpen(false));
$('sidebarBackdrop')?.addEventListener('click',()=>setSidebarOpen(false));
document.addEventListener('keydown',event=>{if(event.key==='Escape')setSidebarOpen(false)});
window.matchMedia('(min-width: 761px)').addEventListener('change',event=>{if(event.matches)setSidebarOpen(false)});
if($('uptimeBars'))$('uptimeBars').innerHTML=Array.from({length:36},()=>'<i></i>').join('');

async function signInWithDiscord(){try{setLoading($('authDiscordBtn'),true,'Opening Discord…');const{error}=await supabase.auth.signInWithOAuth({provider:'discord',options:{scopes:'identify guilds',redirectTo:`${location.origin}/dashboard.html`}});if(error)throw error}catch(e){toast('Discord login failed',e.message||'Could not start login.');setLoading($('authDiscordBtn'),false)}}
$('authDiscordBtn')?.addEventListener('click',signInWithDiscord);

if(isAuthCallback){
 const heading=document.querySelector('#authGate h2'),copy=document.querySelector('#authGate p'),button=$('authDiscordBtn');
 if(heading)heading.textContent='Connecting your dashboard';
 if(copy)copy.textContent='Discord is connected. Loading your servers now…';
 if(button){button.textContent='Connecting…';button.disabled=true}
}
$('loginBtn')?.addEventListener('click',()=>session?toggleServerPicker():signInWithDiscord());
$('logoutBtn')?.addEventListener('click',async()=>{await supabase.auth.signOut();clearProviderTokens();localStorage.removeItem('bound_dashboard_guild');session=null;providerToken=null;managedGuilds=[];selectedGuildId=null;renderSignedOut()});
function renderSignedOut(reason){
 $('authGate')?.classList.remove('hidden');
 // A Bound username/password account (created via Account for faster future
 // logins) still has to link Discord before the dashboard can list servers -
 // that's a real, different state from "not signed in at all", and showing
 // the same generic gate for both used to look like a broken dead end.
 const noDiscord=reason==='no-discord';
 if($('loginBtn'))$('loginBtn').textContent=noDiscord?'Connect Discord':'Discord Login';
 if($('userName'))$('userName').textContent=noDiscord?'Discord not connected':'Not signed in';
 if($('userRole'))$('userRole').textContent='Discord account';
 applyAvatar($('userAvatar'),null,'?');
 if($('serverName'))$('serverName').textContent='Choose a server';
 applyServerIcon($('serverIcon'),null,'B');
 const gateHeading=document.querySelector('#authGate h2'),gateCopy=document.querySelector('#authGate p'),gateBtn=$('authDiscordBtn');
 if(noDiscord){
   if(gateHeading)gateHeading.textContent='Connect Discord to continue';
   if(gateCopy)gateCopy.textContent='You are signed in to your Bound account, but the dashboard still needs Discord to know which servers you can manage.';
   if(gateBtn)gateBtn.textContent='Connect Discord';
 }else{
   if(gateHeading)gateHeading.textContent='Manage Bound with Discord';
   if(gateCopy)gateCopy.textContent='Sign in to see only the servers you are allowed to manage';
   if(gateBtn)gateBtn.textContent='Continue with Discord';
 }
}
async function apiCall(action,{guildId,method='GET',body}={}){const q=new URLSearchParams({action});if(guildId)q.set('guild_id',guildId);return fetch(`/api/dashboard?${q}`,{method,headers:{Authorization:`Bearer ${session.access_token}`,'X-Discord-Provider-Token':providerToken,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});}
// Discord's access token is short-lived; rather than surface "reconnect
// Discord" the moment it expires, try a silent refresh (backed by the
// Discord refresh token captured at sign-in) and transparently retry once
// before ever bothering the user with a real Discord redirect.
async function api(action,opts={}){
  if(!session?.access_token)throw new Error('Your session expired. Sign in again.');
  if(!providerToken){const fresh=await ensureFreshProviderToken();if(fresh)providerToken=fresh;else throw new Error('Discord server access expired. Reconnect Discord.');}
  let r=await apiCall(action,opts);
  if(r.status===401){const refreshed=await refreshProviderToken();if(refreshed){providerToken=refreshed;r=await apiCall(action,opts);}}
  let d={};try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d.error||`Dashboard API failed (${r.status}).`);
  return d;
}

async function bootstrap(){
  if(bootstrapRunning||!session||!providerToken)return;
  bootstrapRunning=true;
  try{
    // Passing the last-selected guild lets the server fold that guild's
    // overview into this same response - saves a whole extra request on
    // first paint versus always following up with a separate loadOverview().
    const d=await api('bootstrap',{guildId:selectedGuildId||undefined});
    managedGuilds=d.guilds||[];
    if(d.reward?.claimed)toast('10,000 Bonds added',d.reward.dm_status==='sent'?'We sent the receipt to your Discord DMs.':'Your one-time dashboard connection reward is ready.');
    const u=d.user||{};
    $('authGate')?.classList.add('hidden');
    if($('userName'))$('userName').textContent=u.display_name||u.username||'Discord user';
    if($('userRole'))$('userRole').textContent='Discord connected';
    applyAvatar($('userAvatar'),u.avatar_url,u.display_name||u.username);
    if($('loginBtn'))$('loginBtn').textContent=u.display_name||u.username||'Discord';
    renderGuildPicker();
    if(selectedGuildId&&!managedGuilds.some(g=>g.id===selectedGuildId))selectedGuildId=null;
    if(!selectedGuildId)selectedGuildId=(managedGuilds.find(g=>g.bound_installed)||managedGuilds[0])?.id||null;
    if(!selectedGuildId)return;
    if(d.overview&&d.overview.guild?.id===selectedGuildId){
      localStorage.setItem('bound_dashboard_guild',selectedGuildId);
      renderGuildPicker();
      const g=managedGuilds.find(x=>x.id===selectedGuildId);
      if(g){if($('serverName'))$('serverName').textContent=g.name;applyServerIcon($('serverIcon'),g.icon_url,g.name)}
      applyOverview(d.overview);
      applyDashboardAccess();
      window.dispatchEvent(new CustomEvent('bound:guild-change',{detail:{guild:g}}));
      if(g?.faction_only)showView('economy');
      if(currentGuild()?.owner)await loadPermissionGrants();
    }else{
      await chooseGuild(selectedGuildId,false);
    }
  }catch(e){console.error(e);toast('Dashboard unavailable',e.message);$('authGate')?.classList.remove('hidden')}finally{bootstrapRunning=false}
}
function factionStatusText(s){return s==='approved'?'Faction approved':s==='needs_owner_migration'?'Needs owner migration':'Awaiting owner approval';}
function renderGuildPicker(){const p=$('serverPicker');if(!p)return;if(!managedGuilds.length){p.innerHTML='<div class="picker-empty">No manageable servers found.</div>';return}p.innerHTML=managedGuilds.map(g=>`<button class="server-option ${g.id===selectedGuildId?'active':''}" data-guild-id="${g.id}">${g.icon_url?`<img src="${g.icon_url}" alt="${escapeHtml(g.name)} icon"><span style="display:none">${avatarFallback(g.name)}</span>`:`<span>${avatarFallback(g.name)}</span>`}<div><b>${escapeHtml(g.name)}</b><small>${g.bound_installed?'Bound detected':'Bound data not detected'} • ${factionStatusText(g.faction_status)}</small></div>${g.faction_status==='approved'?'<em>FACTION</em>':g.bound_installed?'<em>BOUND</em>':''}</button>`).join('');p.querySelectorAll('[data-guild-id]').forEach(b=>b.addEventListener('click',()=>chooseGuild(b.dataset.guildId,true)));}
function toggleServerPicker(){const p=$('serverPicker');if(p)p.hidden=!p.hidden}
$('serverPickerBtn')?.addEventListener('click',()=>session?toggleServerPicker():signInWithDiscord());
document.addEventListener('click',e=>{const p=$('serverPicker');if(!p||p.hidden)return;if(!p.contains(e.target)&&e.target!==$('serverPickerBtn')&&e.target!==$('loginBtn'))p.hidden=true});
async function chooseGuild(id,close=true){selectedGuildId=id;localStorage.setItem('bound_dashboard_guild',id);if(close&&$('serverPicker'))$('serverPicker').hidden=true;renderGuildPicker();const g=managedGuilds.find(x=>x.id===id);if(g){if($('serverName'))$('serverName').textContent=g.name;applyServerIcon($('serverIcon'),g.icon_url,g.name)}applyDashboardAccess();window.dispatchEvent(new CustomEvent('bound:guild-change',{detail:{guild:g}}));if(g?.faction_only)showView('economy');await Promise.all([loadOverview(),g?.owner?loadPermissionGrants():Promise.resolve()]);}

function currentGuild(){return managedGuilds.find(g=>g.id===selectedGuildId)||null}
function can(permission){const g=currentGuild();return Boolean(g?.owner||g?.permissions?.includes(permission))}
function applyDashboardAccess(){
 const g=currentGuild(),owner=Boolean(g?.owner),card=$('dashboardAccessCard');
 if(card)card.hidden=!owner;
 document.querySelectorAll('[data-requires-permission]').forEach(el=>{const allowed=can(el.dataset.requiresPermission);el.disabled=!allowed;el.title=allowed?'':'The server owner has not granted this permission.'});
 document.body.dataset.dashboardOwner=String(owner);
 document.body.classList.toggle('faction-only',Boolean(g?.faction_only));
}

function ensureConfigPanels(){
 const safety=$('view-safety');if(safety&&!$('liveSafetyConfig')){safety.insertAdjacentHTML('beforeend',`<div class="dashboard-grid" id="liveSafetyConfig"><article class="panel"><div class="panel-title"><div><small>SAFETY CONFIG</small><h3>Enforcement</h3></div></div><div class="settings-list"><label><span><b>Safety enabled</b><small>Master safety enforcement for this server</small></span><button class="switch" data-group="safety" data-key="safety_enabled"><i></i></button></label><label><span><b>Auto-ban minor safety</b><small>Automatically enforce approved minor-safety flags</small></span><button class="switch" data-group="safety" data-key="auto_ban_minor_safety"><i></i></button></label><label><span><b>Auto-ban harassment/TOS</b><small>Automatically enforce approved harassment/TOS flags</small></span><button class="switch" data-group="safety" data-key="auto_ban_harassment_tos"><i></i></button></label><label><span><b>Network bans</b><small>Automatically enforce Bound network bans</small></span><button class="switch" data-group="safety" data-key="auto_ban_network_ban"><i></i></button></label><label><span><b>Auto-unban on removal</b><small>Undo supported bans when a safety flag is removed</small></span><button class="switch" data-group="safety" data-key="auto_unban_on_removal"><i></i></button></label></div></article><article class="panel"><div class="panel-title"><div><small>GAG SAFETY</small><h3>Gagging configuration</h3></div><button class="primary-mini" id="saveGagConfig">Save</button></div><div class="settings-list"><label><span><b>Gag log channel</b><small>Discord channel ID for gag/safety logs</small></span><input id="gagLogChannel" placeholder="Channel ID"></label><label><span><b>Blocked gag channels</b><small>Comma-separated channel IDs where gag conversion must not run</small></span><input id="gagBlockedChannels" placeholder="123, 456"></label></div></article></div>`)}
 const faction=$('view-economy');if(faction&&!$('factionApprovalCard')){faction.insertAdjacentHTML('afterbegin',`<article class="panel" id="factionApprovalCard" style="margin-bottom:12px"><div class="panel-title"><div><small>SERVER FACTION STATUS</small><h3 id="factionStatusTitle">Awaiting owner approval</h3></div><span class="all-good" id="factionStatusBadge">LOCKED</span></div><p id="factionStatusText" style="color:#8d838f;font-size:9px;line-height:1.6;margin:0">This Discord server does not have an approved canonical faction yet.</p></article>`)}
 const settings=$('view-settings');if(settings&&!$('dashboardAccessCard')){settings.insertAdjacentHTML('beforeend',`<article class="panel dashboard-access-card" id="dashboardAccessCard" hidden><div class="panel-title"><div><small>OWNER SECURITY</small><h3>Dashboard access</h3></div><span class="all-good">OWNER ONLY</span></div><p>Grant staff only the dashboard controls they need. Discord Administrator alone does not bypass this list.</p><div class="dashboard-access-form"><label><span>Discord user ID</span><input id="dashboardAccessUserId" inputmode="numeric" autocomplete="off" placeholder="123456789012345678"></label><div class="permission-picks">${Object.entries(permissionLabels).map(([key,label])=>`<label><input type="checkbox" value="${key}" checked><span>${label}</span></label>`).join('')}</div><button class="primary-action" id="saveDashboardAccess" type="button">Grant dashboard access</button></div><div class="dashboard-access-list" id="dashboardAccessList"><div class="empty-state">No delegated dashboard access.</div></div></article>`)}
 document.querySelectorAll('.switch[data-group]').forEach(b=>{if(b.dataset.boundHandler)return;b.dataset.boundHandler='1';b.addEventListener('click',()=>toggleSetting(b))});
 $('saveGagConfig')?.addEventListener('click',saveGagConfig);
 $('saveDashboardAccess')?.addEventListener('click',saveDashboardAccess);
}
ensureConfigPanels();

function hydrateLegacySettings(){const labels=[...document.querySelectorAll('#view-settings .settings-list label')];const defs=[{i:0,g:'safety',k:'safety_enabled',t:'Safety system',d:'Enable or disable Bound safety enforcement for this server.'},{i:2,g:'verify',k:'welcome_enabled',t:'Welcome messages',d:'Send the configured welcome message after verification.'},{i:3,g:'verify',k:'post_verify_enabled',t:'Post-verify messages',d:'Send the configured follow-up message after verification.'}];for(const x of defs){const l=labels[x.i],b=l?.querySelector('.switch');if(!l||!b)continue;l.querySelector('b').textContent=x.t;l.querySelector('small').textContent=x.d;b.disabled=false;b.dataset.group=x.g;b.dataset.key=x.k;if(!b.dataset.boundHandler){b.dataset.boundHandler='1';b.addEventListener('click',()=>toggleSetting(b))}}const f=document.querySelector('#view-economy .switch');if(f){f.dataset.group='faction';f.dataset.key='applications_open';const l=f.closest('label');if(l){l.querySelector('b').textContent='Faction applications';l.querySelector('small').textContent='Allow users to apply to this server faction.'}}}
hydrateLegacySettings();

document.querySelectorAll('#view-settings .switch, #saveSettings').forEach(el=>el.dataset.requiresPermission='manage_settings');
document.querySelectorAll('#view-safety .switch, #saveGagConfig').forEach(el=>el.dataset.requiresPermission='manage_safety');
document.querySelectorAll('#view-economy .switch').forEach(el=>el.dataset.requiresPermission='manage_factions');

async function loadPermissionGrants(){
 const list=$('dashboardAccessList');if(!list||!selectedGuildId||!currentGuild()?.owner)return;
 list.innerHTML='<div class="empty-state">Loading access rules…</div>';
 try{const d=await api('permissions',{guildId:selectedGuildId});const grants=d.grants||[];list.innerHTML=grants.length?grants.map(g=>`<div class="dashboard-access-row"><span class="mini-avatar">${avatarFallback(g.profile?.display_name||g.user_id)}</span><div><b>${escapeHtml(g.profile?.display_name||g.user_id)}</b><small>${g.permissions.filter(x=>permissionLabels[x]).map(x=>permissionLabels[x]).join(' • ')||'View only'} · ${escapeHtml(g.user_id)}</small></div><button type="button" data-revoke-access="${escapeHtml(g.user_id)}">Remove</button></div>`).join(''):'<div class="empty-state">Only you can access this server dashboard right now.</div>';list.querySelectorAll('[data-revoke-access]').forEach(btn=>btn.addEventListener('click',()=>revokeDashboardAccess(btn.dataset.revokeAccess)))}catch(e){list.innerHTML=`<div class="empty-state">${escapeHtml(e.message)}</div>`}
}
async function saveDashboardAccess(){
 const btn=$('saveDashboardAccess'),userId=$('dashboardAccessUserId')?.value.trim()||'',permissions=[...document.querySelectorAll('.permission-picks input:checked')].map(x=>x.value);
 try{setLoading(btn,true,'Saving access…');await api('permissions',{guildId:selectedGuildId,method:'POST',body:{user_id:userId,permissions}});$('dashboardAccessUserId').value='';toast('Dashboard access saved','The staff member can now use only the selected controls.');await loadPermissionGrants()}catch(e){toast('Could not save access',e.message)}finally{setLoading(btn,false)}
}
async function revokeDashboardAccess(userId){try{await api('permissions',{guildId:selectedGuildId,method:'POST',body:{user_id:userId,revoke:true}});toast('Dashboard access removed','That user can no longer open this server dashboard.');await loadPermissionGrants()}catch(e){toast('Could not remove access',e.message)}}

async function toggleSetting(btn){if(!selectedGuildId)return toast('Choose a server','Select a server first.');if(btn.disabled||btn.dataset.saving==='1')return;const old=btn.classList.contains('on'),next=!old;setSwitchState(btn,next);btn.dataset.saving='1';btn.disabled=true;try{const d=await api('toggle',{guildId:selectedGuildId,method:'PATCH',body:{group:btn.dataset.group,key:btn.dataset.key,value:next}});setSwitchState(btn,d.value);toast('Setting updated',`${btn.closest('label')?.querySelector('b')?.textContent||'Setting'} is now ${d.value?'enabled':'disabled'}.`)}catch(e){setSwitchState(btn,old);toast('Could not update setting',e.message)}finally{btn.dataset.saving='0';const needed=btn.dataset.group==='safety'?'manage_safety':btn.dataset.group==='faction'?'manage_factions':'manage_settings';btn.disabled=!can(needed)||(btn.dataset.group==='faction'&&!overview?.faction?.approved)}}
async function saveGagConfig(){if(!selectedGuildId)return;const btn=$('saveGagConfig');try{setLoading(btn,true,'Saving…');const blocked=($('gagBlockedChannels')?.value||'').split(',').map(x=>x.trim()).filter(Boolean);const d=await api('gag_config',{guildId:selectedGuildId,method:'PATCH',body:{log_channel_id:$('gagLogChannel')?.value||'',blocked_channel_ids:blocked}});toast('Gag config saved','Gag safety channels are synced to Supabase.');if(d.config)renderGagConfig(d.config)}catch(e){toast('Could not save gag config',e.message)}finally{setLoading(btn,false)}}

async function loadOverview(){if(!selectedGuildId)return;try{applyOverview(await api('overview',{guildId:selectedGuildId}))}catch(e){console.error(e);toast('Live data unavailable',e.message)}}
function applyOverview(data){overview=data;const d=overview;if($('serverName'))$('serverName').textContent=d.guild?.name||'Server';applyServerIcon($('serverIcon'),d.guild?.icon_url,d.guild?.name);if($('metricGuildStatus'))$('metricGuildStatus').textContent=d.activation?.tos_accepted?'Activated':'Setup';if($('metricTos'))$('metricTos').textContent=d.activation?.tos_accepted?'Terms accepted':'Terms pending';if($('metricVerified'))$('metricVerified').textContent=d.verification?'Yes':'No';if($('metricSafety'))$('metricSafety').textContent=String(d.safety?.pending??0);if($('metricBonds'))$('metricBonds').textContent=d.economy?.total_nugs_display||'0';if($('metricEconomyUsers'))$('metricEconomyUsers').textContent=String(d.economy?.users??0);if($('safetyOpen'))$('safetyOpen').textContent=String(d.safety?.pending??0);if($('safetyCages'))$('safetyCages').textContent=String(d.safety?.cages?.length??0);if($('safetyGags'))$('safetyGags').textContent=String(d.safety?.active_gags?.length??0);if($('safetyNetwork'))$('safetyNetwork').textContent=d.safety?.config?.safety_enabled?'Enabled':'Disabled';if($('economyCirculation'))$('economyCirculation').textContent=d.faction?.display_faction?fmt(d.faction.display_faction.money):'No faction linked';if($('economyUsers'))$('economyUsers').textContent=d.faction?.display_faction?String(d.faction.members?.length||0):'—';if($('economySync'))$('economySync').textContent=d.faction?.approved?'Approved':(d.faction?.display_faction?'Pending approval':'Locked');if($('prefixInput'))$('prefixInput').value=d.settings?.prefix||'£';renderActivity(d.activity||[]);renderSafetyRows(d.safety?.cases||[]);renderSwitches(d);renderFaction(d.faction);renderGagConfig(d.safety?.gag_config||{});renderFactionLeaderboard(d.faction?.members||[]);applyDashboardAccess()}
function renderSwitches(d){const s=d.safety?.config||{},v=d.verification||{};document.querySelectorAll('.switch[data-group="safety"]').forEach(b=>setSwitchState(b,s[b.dataset.key]??false));document.querySelectorAll('.switch[data-group="verify"]').forEach(b=>setSwitchState(b,v[b.dataset.key]??false));const f=document.querySelector('.switch[data-group="faction"]');if(f){setSwitchState(f,d.faction?.display_faction?.applications_open??false);f.disabled=!d.faction?.approved}}
function renderFaction(f){const title=$('factionStatusTitle'),badge=$('factionStatusBadge'),text=$('factionStatusText');if(!f)return;const df=f.display_faction;if(f.approved){title.textContent=df?.faction_name||'Approved faction';badge.textContent='APPROVED';text.textContent=`This Discord server is the faction “${df?.faction_name||'Faction'}”. Treasury: ${fmt(df?.money)} Bonds • Power: ${fmt(df?.power)} • Level: ${df?.faction_level||1}.`}else if(f.ambiguous){title.textContent='Needs owner migration';badge.textContent='LOCKED';text.textContent=`This server currently has ${f.matches} factions linked to it. Controls stay locked until the Bound owner chooses the canonical server faction.`}else if(df){title.textContent=df.faction_name||'Faction (pending approval)';badge.textContent='PENDING APPROVAL';text.textContent=`This server is linked to “${df.faction_name||'Faction'}” but the Bound owner has not approved it as canonical yet. Treasury: ${fmt(df.money)} Bonds • Power: ${fmt(df.power)} • Level: ${df.faction_level||1}. Admin controls stay locked until approval.`}else{title.textContent='Awaiting owner approval';badge.textContent='LOCKED';text.textContent='No faction is linked to this Discord server yet.'}}
function renderGagConfig(c){if($('gagLogChannel'))$('gagLogChannel').value=c.log_channel_id||'';if($('gagBlockedChannels'))$('gagBlockedChannels').value=(c.blocked_channel_ids||[]).join(', ')}
function renderFactionLeaderboard(rows){const el=document.querySelector('#view-economy .leaderboard');if(!el)return;if(!overview?.faction?.display_faction){el.innerHTML='<div class="empty-state">No faction linked to this server yet.</div>';return}if(!rows.length){el.innerHTML='<div class="empty-state">No faction members yet.</div>';return}el.innerHTML=rows.slice(0,8).map((m,i)=>`<div><em>${i+1}</em><span class="mini-avatar">${avatarFallback(m.display_name)}</span><b>${escapeHtml(m.display_name)}</b><strong>${fmt(m.balance)} ⛓</strong></div>`).join('')}
function renderSafetyRows(rows){const el=$('safetyRows');if(!el)return;if(!rows.length){el.innerHTML='<div class="empty-state table-empty">No recent safety cases for this server.</div>';return}el.innerHTML=rows.map(r=>`<div class="table-row"><span><i class="mini-avatar">${avatarFallback(r.reported_user_id)}</i>${escapeHtml(r.reported_user_id)}</span><span>${escapeHtml((r.requested_flag_type||'case').replaceAll('_',' '))}</span><span>${r.created_at?new Date(r.created_at).toLocaleDateString():'—'}</span><span><em class="risk ${r.requested_flag_type==='minor_safety'?'high':'medium'}">${r.requested_flag_type==='minor_safety'?'HIGH':'REVIEW'}</em></span><span>${escapeHtml(r.status||'unknown')}</span></div>`).join('')}
function renderActivity(rows){const el=$('activityList');if(!el)return;if(!rows.length){el.innerHTML='<div class="empty-state">No recent activity for this server.</div>';return}el.innerHTML=rows.map(r=>`<div class="activity-item"><span class="activity-icon">⛓</span><div><b>${escapeHtml((r.activity_type||'activity').replaceAll('_',' '))}</b><small>User ${escapeHtml(r.user_id)}${Number(r.money_earned||0)?` • ${fmt(r.money_earned)} Bonds`:''}</small></div><small>${relativeTime(r.created_at)}</small></div>`).join('')}

$('prefixInput')?.addEventListener('input',()=>{if($('saveState'))$('saveState').textContent='Unsaved changes'});
$('saveSettings')?.addEventListener('click',async()=>{if(!selectedGuildId)return toast('Choose a server','Select a server first.');const btn=$('saveSettings');try{setLoading(btn,true,'Saving…');const prefix=$('prefixInput')?.value||'';const d=await api('settings',{guildId:selectedGuildId,method:'PATCH',body:{prefix}});if($('prefixInput'))$('prefixInput').value=d.settings?.prefix||prefix;if($('saveState'))$('saveState').textContent='All changes saved';toast('Server settings saved','Bound will pick up the new prefix shortly.')}catch(e){toast('Could not save',e.message)}finally{setLoading(btn,false)}});

supabase.auth.onAuthStateChange((event,newSession)=>{
 session=newSession;
 if(newSession?.provider_token)providerToken=newSession.provider_token;
 if(event==='SIGNED_OUT'){providerToken=null;renderSignedOut();return}
 if(newSession&&providerToken&&(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='INITIAL_SESSION')){queueMicrotask(()=>bootstrap())}
});

(async()=>{
 let existing=null;
 try{existing=await authReady}catch(error){console.error('Bound sign-in failed:',error);sessionStorage.setItem('bound_auth_error',error?.message||'Discord sign-in failed.');renderSignedOut();return}
 session=existing;
 if(existing?.provider_token)providerToken=existing.provider_token;
 if(session&&providerToken){await bootstrap();return}
 if(session&&!providerToken){
   // No provider token in memory yet - it may just not have landed in
   // storage/state this tick (fresh OAuth redirect), or it may genuinely be
   // stale. Try a silent Discord refresh before giving up and showing the
   // signed-out gate.
   const fresh=await ensureFreshProviderToken();
   if(fresh){providerToken=fresh;await bootstrap();}else renderSignedOut('no-discord');
   return;
 }
 renderSignedOut();
})();

