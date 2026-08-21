(() => {
  const providerBackup = localStorage.getItem('bound_discord_provider_token_backup');
  if (!sessionStorage.getItem('bound_discord_provider_token') && providerBackup) {
    sessionStorage.setItem('bound_discord_provider_token', providerBackup);
  }

  const style = document.createElement('style');
  style.textContent = `
    .bound-polish-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
    .bound-rank-list{display:grid;gap:8px;margin-top:10px}.bound-rank{display:grid;grid-template-columns:28px 34px 1fr auto;gap:9px;align-items:center;padding:10px 11px;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025)}
    .bound-rank>em{font-style:normal;font-size:11px;opacity:.65}.bound-rank img,.bound-rank .rank-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;background:rgba(255,255,255,.08);display:grid;place-items:center;font-size:11px}.bound-rank b{font-size:11px}.bound-rank strong{font-size:11px;color:#f4cf63}
    .coming-chat{margin-top:14px;border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:14px;background:linear-gradient(145deg,rgba(255,255,255,.035),rgba(255,255,255,.015))}.coming-chat-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}.coming-chat-head span{font-size:9px;letter-spacing:.13em;color:#f4cf63}.coming-chat-head em{font-style:normal;font-size:9px;border:1px solid rgba(244,207,99,.25);border-radius:999px;padding:5px 8px;color:#f4cf63}.coming-chat-preview{display:grid;gap:8px}.coming-chat-msg{display:flex;gap:8px;align-items:flex-start}.coming-chat-msg i{width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.07);display:grid;place-items:center;font-style:normal;font-size:9px}.coming-chat-msg div{background:rgba(255,255,255,.045);border-radius:12px;padding:8px 10px;max-width:80%}.coming-chat-msg b{display:block;font-size:9px;margin-bottom:3px}.coming-chat-msg small{font-size:9px;color:#9c929e}.coming-chat-bar{margin-top:10px;display:flex;gap:8px;align-items:center;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:9px 10px;color:#726b74;font-size:10px}.coming-chat-bar span{margin-left:auto;color:#f4cf63}
    .gag-master-row{margin-bottom:10px}.gag-master-row .switch{flex:0 0 auto}
    @media(max-width:760px){.bound-polish-grid{grid-template-columns:1fr}.bound-rank{grid-template-columns:24px 32px 1fr auto}}
  `;
  document.head.appendChild(style);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const compact = n => { n=Number(n||0); return n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n); };
  const avatar = row => row.avatar_url ? `<img src="${esc(row.avatar_url)}" alt="">` : `<span class="rank-avatar">${esc((row.name||'?').charAt(0).toUpperCase())}</span>`;
  const authToken = () => {
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i)||'';
      if(!key.startsWith('sb-')||!key.endsWith('-auth-token')) continue;
      try { const raw=JSON.parse(localStorage.getItem(key)||'null'); const token=raw?.access_token||raw?.currentSession?.access_token; if(token)return token; } catch {}
    }
    return null;
  };
  const providerToken = () => sessionStorage.getItem('bound_discord_provider_token') || localStorage.getItem('bound_discord_provider_token_backup') || '';
  const guildId = () => localStorage.getItem('bound_dashboard_guild') || '';

  function forceOverview() {
    const overviewBtn=document.querySelector('.nav-item[data-view="overview"]');
    if (overviewBtn) overviewBtn.click();
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-overview'));
    document.querySelectorAll('.nav-item').forEach(v=>v.classList.toggle('active',v.dataset.view==='overview'));
    const title=document.getElementById('pageTitle'); if(title) title.textContent='Overview';
    sessionStorage.removeItem('bound_open_private');
    if(location.hash==='#private') history.replaceState({},document.title,location.pathname+location.search);
  }

  function clearStaleServerState(name='Loading server') {
    const ids=['metricGuildStatus','metricTos','metricVerified','metricSafety','metricBonds','metricEconomyUsers','safetyOpen','safetyCages','safetyGags','safetyNetwork','economyCirculation','economyUsers','economySync'];
    ids.forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='…'});
    const privateArea=document.getElementById('privateBuildArea'); if(privateArea) privateArea.hidden=true;
    const noBuild=document.getElementById('privateNoBuild'); if(noBuild) noBuild.hidden=true;
    const status=document.getElementById('privateBuildStatus'); if(status){status.textContent='CHECKING PRIVATE BUILD';status.className='private-build-status loading'}
    const privateName=document.getElementById('privateServerName'); if(privateName) privateName.textContent=name;
  }

  document.addEventListener('click', event => {
    const button=event.target.closest?.('[data-guild-id]');
    if(!button) return;
    const name=button.querySelector('b')?.textContent?.trim()||'Loading server';
    clearStaleServerState(name);
    forceOverview();
    setTimeout(()=>{ forceOverview(); void loadGagState(); },0);
    setTimeout(()=>{ void loadGagState(); },700);
  }, true);

  const serverName=document.getElementById('serverName');
  if(serverName){
    let previous=serverName.textContent;
    new MutationObserver(()=>{
      const next=serverName.textContent;
      if(next!==previous){previous=next;forceOverview();void loadGagState();}
    }).observe(serverName,{childList:true,characterData:true,subtree:true});
  }

  async function loadLeaderboards(){
    const overview=document.getElementById('view-overview');
    if(!overview||document.getElementById('boundLeaderboards')) return;
    const shell=document.createElement('div');
    shell.id='boundLeaderboards';
    shell.innerHTML=`<div class="bound-polish-grid"><article class="panel"><div class="panel-title"><div><small>ALL TIME</small><h3>Top BDSM XP</h3></div><span class="all-good">TOP 3</span></div><div class="bound-rank-list" id="bdsmXpRanks"><div class="empty-state">Loading leaderboard</div></div></article><article class="panel"><div class="panel-title"><div><small>ALL TIME</small><h3>Richest Bound users</h3></div><span class="all-good">TOP 3</span></div><div class="bound-rank-list" id="moneyRanks"><div class="empty-state">Loading leaderboard</div></div></article></div><div class="coming-chat"><div class="coming-chat-head"><div><span>COMING SOON</span><h3>Bound Chat</h3></div><em>EARLY PREVIEW</em></div><div class="coming-chat-preview"><div class="coming-chat-msg"><i>B</i><div><b>Bound</b><small>Your communities could feel a lot closer</small></div></div><div class="coming-chat-msg"><i>♡</i><div><b>Social</b><small>Profiles relationships RP and community chat in one place</small></div></div></div><div class="coming-chat-bar">Message Bound Chat <span>Send</span></div></div>`;
    overview.appendChild(shell);
    try{
      const r=await fetch('/api/leaderboards'); const d=await r.json(); if(!r.ok)throw new Error(d.error||'Could not load leaderboards');
      const render=(id,rows,suffix)=>{const el=document.getElementById(id);if(!el)return;el.innerHTML=(rows||[]).map(row=>`<div class="bound-rank"><em>#${row.rank}</em>${avatar(row)}<b>${esc(row.name)}</b><strong>${compact(row.value)} ${suffix}</strong></div>`).join('')||'<div class="empty-state">No rankings yet</div>';};
      render('bdsmXpRanks',d.bdsm,'XP'); render('moneyRanks',d.money,'⛓');
    }catch(error){['bdsmXpRanks','moneyRanks'].forEach(id=>{const e=document.getElementById(id);if(e)e.innerHTML='<div class="empty-state">Leaderboard unavailable</div>'});}
  }

  function ensureGagToggle(){
    const card=document.getElementById('saveGagConfig')?.closest('article');
    const list=card?.querySelector('.settings-list');
    if(!list||document.getElementById('gagMasterToggle'))return;
    const label=document.createElement('label'); label.className='gag-master-row';
    label.innerHTML='<span><b>Gag system</b><small>Enable or disable gag message conversion in this server</small></span><button class="switch" id="gagMasterToggle" aria-pressed="true"><i></i></button>';
    list.prepend(label);
    document.getElementById('gagMasterToggle')?.addEventListener('click',saveGagState);
  }

  async function loadGagState(){
    ensureGagToggle();
    const gid=guildId(),token=authToken(),provider=providerToken(),btn=document.getElementById('gagMasterToggle');
    if(!gid||!token||!provider||!btn)return;
    btn.disabled=true;
    try{
      const r=await fetch(`/api/gag-control?guild_id=${encodeURIComponent(gid)}`,{headers:{Authorization:`Bearer ${token}`,'X-Discord-Provider-Token':provider}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not load gag settings');
      const on=d.config?.gag_enabled!==false;btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',String(on));
    }catch(error){console.error(error)}finally{btn.disabled=false;}
  }

  async function saveGagState(){
    const btn=document.getElementById('gagMasterToggle'),gid=guildId(),token=authToken(),provider=providerToken();if(!btn||!gid||!token||!provider)return;
    const previous=btn.classList.contains('on'),next=!previous;btn.classList.toggle('on',next);btn.disabled=true;
    try{
      const r=await fetch(`/api/gag-control?guild_id=${encodeURIComponent(gid)}`,{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'X-Discord-Provider-Token':provider,'Content-Type':'application/json'},body:JSON.stringify({gag_enabled:next})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save gag setting');
      const saved=d.config?.gag_enabled!==false;btn.classList.toggle('on',saved);btn.setAttribute('aria-pressed',String(saved));
    }catch(error){btn.classList.toggle('on',previous);alert(error.message||'Could not save gag setting');}finally{btn.disabled=false;}
  }

  void loadLeaderboards();
  const timer=setInterval(()=>{ensureGagToggle();if(document.getElementById('gagMasterToggle')){clearInterval(timer);void loadGagState();}},300);
})();
