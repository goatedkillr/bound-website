(() => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'private-dashboard.css';
  document.head.appendChild(css);

  if (!document.querySelector('link[href="showcase.css"]')) {
    const showcaseCss = document.createElement('link');
    showcaseCss.rel = 'stylesheet';
    showcaseCss.href = 'showcase.css';
    document.head.appendChild(showcaseCss);
  }
  if (!document.querySelector('script[src="showcase.js"]')) {
    const showcaseScript = document.createElement('script');
    showcaseScript.type = 'module';
    showcaseScript.src = 'showcase.js';
    document.body.appendChild(showcaseScript);
  }

  const wantsPrivate = location.hash === '#private' || sessionStorage.getItem('bound_open_private') === '1';
  if (location.hash === '#private') sessionStorage.setItem('bound_open_private', '1');
  const defaultCrumb = document.querySelector('.topbar-left small');
  if (defaultCrumb && !wantsPrivate) defaultCrumb.textContent = 'BOUND / CONTROL CENTRE';

  const nav = document.querySelector('.side-nav');
  if (nav && !document.querySelector('[data-view="private"]')) {
    const settingsLabel = [...nav.querySelectorAll('.nav-label')].find(x => x.textContent?.trim() === 'SETTINGS');
    const privateLabel = document.createElement('small');
    privateLabel.className = 'nav-label';
    privateLabel.textContent = 'PREMIUM';
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = 'private';
    btn.innerHTML = '<span>✦</span>Private Bound <em>PRO</em>';
    if (settingsLabel) { nav.insertBefore(privateLabel, settingsLabel); nav.insertBefore(btn, settingsLabel); }
    else nav.append(privateLabel, btn);
  }

  const content = document.querySelector('.dashboard-content');
  if (content && !document.getElementById('view-private')) {
    const section = document.createElement('section');
    section.className = 'view private-view';
    section.id = 'view-private';
    section.innerHTML = `
      <div class="private-server-banner" id="privateServerBanner">
        <div class="private-server-identity"><span class="private-server-icon" id="privateServerIcon">B</span><div><small>SELECTED SERVER</small><b id="privateServerName">Choose a server</b></div></div>
        <span class="private-build-status loading" id="privateBuildStatus">CHECKING PRIVATE BUILD</span>
      </div>

      <div id="privateNoBuild" hidden>
        <div class="private-hero private-request-hero">
          <div>
            <span class="private-kicker"><i></i> NO PRIVATE BUILD</span>
            <h2>This server uses Bound.<br><span>It could be so much more.</span></h2>
            <p id="privateNoBuildText">This server does not currently have a dedicated Private Bound build. Request one to unlock server-only staff systems, custom tickets, economy, subscriptions, moderation, automation and private database-backed tools.</p>
            <div class="private-actions"><a class="private-primary" href="https://discord.gg/NVseqMDNRd" target="_blank" rel="noopener noreferrer">Request a private build ↗</a><button class="private-secondary" id="privatePreviewBtn">See what is possible ↓</button></div>
          </div>
          <div class="private-preview private-locked-preview"><div class="private-preview-top"><div class="private-preview-title"><span class="private-preview-logo">B</span><div><b>Private Bound</b><small>SERVER-SCOPED BUILD</small></div></div><span class="private-tag locked">NOT ENABLED</span></div><div class="private-lock-core"><span>✦</span><b>Private systems are not enabled for this server.</b><small>Each private build gets its own server-scoped data and only exposes modules assigned to that community.</small></div></div>
        </div>
      </div>

      <div id="privateBuildArea" hidden>
        <div class="private-hero">
          <div>
            <span class="private-kicker"><i></i> PRIVATE SERVER EDITION</span>
            <h2><span id="privateBuildName">Private Bound</span>,<br>built around this community.</h2>
            <p>This server has a dedicated Private Bound build. The dashboard below only shows the modules assigned to this server, backed by private server-scoped data rather than the public Bound dashboard database.</p>
            <div class="private-actions"><button class="private-primary" id="privateExploreBtn">Explore this build ↓</button></div>
            <div class="private-proof"><div><b>Private database</b><span>Server-scoped records</span></div><div><b>Permission checked</b><span>Manage Server required</span></div><div><b>Module locked</b><span>Only assigned features show</span></div></div>
          </div>
          <div class="private-preview">
            <div class="private-preview-top"><div class="private-preview-title"><span class="private-preview-logo">B</span><div><b id="privatePreviewName">Private Bound</b><small>LIVE SERVER CONTROL CENTRE</small></div></div><span class="private-tag">PRIVATE BUILD</span></div>
            <div class="private-preview-shell"><div class="private-mini-nav" id="privateMiniNav"></div><div class="private-mini-main"><div class="private-mini-head"><small id="privateMiniCrumb">SERVER / PRIVATE BUILD</small><b>Live private systems.</b></div><div class="private-mini-metrics" id="privateMiniMetrics"></div><div class="private-mini-feed" id="privateMiniFeed"></div></div></div>
          </div>
        </div>

        <div class="private-section-head" id="privateModules"><div><small>THIS SERVER'S BUILD</small><h3>Private modules enabled here.</h3></div><p>Nothing on this page is assumed globally. Each module below belongs to the selected Discord server and can have its own settings, data and workflows.</p></div>
        <div class="private-modules" id="privateModuleGrid"></div>

        <div class="private-case">
          <article class="private-case-copy"><span class="private-kicker"><i></i> LIVE PRIVATE DATA</span><h3 id="privateDataTitle">Server-specific stack.</h3><p>The figures here come from the private Bound database and are filtered by the selected Discord server ID.</p><div class="private-case-stats" id="privateDataStats"></div></article>
          <article class="private-build-list" id="privateBuildList"></article>
        </div>
      </div>

      <div class="private-section-head" id="privatePossibilities"><div><small>PRIVATE BOUND</small><h3>What a custom build can include.</h3></div><p>Private builds can reuse proven Bound systems or go further with server-only commands, custom data, branded flows and automation.</p></div>
      <div class="private-modules" id="privatePossibilityGrid">
        <article class="private-module"><span class="private-module-icon">♙</span><small>STAFF OPERATIONS</small><h4>Run your team properly.</h4><p>Clocking, temporary roles, breaks, assignments, performance and automated access.</p></article>
        <article class="private-module"><span class="private-module-icon">▱</span><small>TICKETS & SUPPORT</small><h4>Support that feels custom.</h4><p>Panels, questions, claims, transcripts, ratings and staff tracking.</p></article>
        <article class="private-module"><span class="private-module-icon">⛓</span><small>SERVER ECONOMY</small><h4>Your own economy loop.</h4><p>Currency, work, fishing, hunting, robberies, heists, shops and progression.</p></article>
        <article class="private-module"><span class="private-module-icon">✦</span><small>SUBSCRIPTIONS</small><h4>Make premium feel premium.</h4><p>Personal roles, giveable roles, panels, autoresponders and perks.</p></article>
        <article class="private-module"><span class="private-module-icon">⌁</span><small>MODERATION</small><h4>Moderation built for your rules.</h4><p>Cases, configurable DMs, jail flows, isolation and private logs.</p></article>
        <article class="private-module"><span class="private-module-icon">⚙</span><small>AUTOMATION</small><h4>Remove repetitive work.</h4><p>AFK, levels, auto roles, reactions, threads and custom workflows.</p></article>
      </div>

      <div class="private-upgrade"><div><span class="private-kicker">YOUR SERVER, YOUR VERSION</span><h3>Want another private module?</h3><p>Private Bound builds can expand without exposing that system to every other Bound server.</p></div><div class="private-actions"><a class="private-primary" href="https://discord.gg/NVseqMDNRd" target="_blank" rel="noopener noreferrer">Talk to Bound Society ↗</a></div></div>`;
    content.appendChild(section);
  }

  const MODULES = {
    staff: { icon:'♙', label:'STAFF OPERATIONS', title:'Staff control centre', desc:'Clocking, staff members, breaks, assignments and temporary access.' },
    tickets: { icon:'▱', label:'TICKETS & SUPPORT', title:'Advanced support stack', desc:'Tickets, claims, transcripts, ratings and verification workflows.' },
    economy: { icon:'⛓', label:'SERVER ECONOMY', title:'Private economy', desc:'Bonds, wallets, banks, work, games, shops and progression.' },
    subscriptions: { icon:'✦', label:'SUBSCRIPTIONS', title:'Premium subscriptions', desc:'VIP, Filthy and Plus roles, perks and subscriber tools.' },
    moderation: { icon:'⌁', label:'MODERATION', title:'Private moderation', desc:'Warnings, mutes, bans, jail, configurable DMs and case history.' },
    automation: { icon:'⚙', label:'AUTOMATION', title:'Server automation', desc:'AFK, levels, auto channels, reactions and repetitive workflow removal.' },
    safety: { icon:'◆', label:'SAFETY', title:'Private safety workflows', desc:'Server-specific safety controls and protected containment workflows.' },
  };
  const fmt = n => new Intl.NumberFormat('en-GB').format(Number(n || 0));
  const compact = n => { n=Number(n||0); return n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n); };
  function selectedGuildId(){ return localStorage.getItem('bound_dashboard_guild') || ''; }
  function selectedGuildName(){ return document.getElementById('serverName')?.textContent?.trim() || 'Choose a server'; }
  function authTokenFromStorage(){
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i)||'';
      if (!key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      try { const raw=JSON.parse(localStorage.getItem(key)||'null'); const token=raw?.access_token || raw?.currentSession?.access_token; if(token) return token; } catch {}
    }
    return null;
  }
  function providerToken(){ return sessionStorage.getItem('bound_discord_provider_token') || localStorage.getItem('bound_discord_provider_token_backup') || null; }
  function setBanner(name, status, mode='loading') {
    const nameEl=document.getElementById('privateServerName'), statusEl=document.getElementById('privateBuildStatus'), icon=document.getElementById('privateServerIcon');
    if(nameEl) nameEl.textContent=name||'Choose a server'; if(icon) icon.textContent=(name||'B').charAt(0).toUpperCase();
    if(statusEl){ statusEl.textContent=status; statusEl.className=`private-build-status ${mode}`; }
  }
  function renderNoBuild(name, configured=true) {
    document.getElementById('privateBuildArea')?.setAttribute('hidden',''); document.getElementById('privateNoBuild')?.removeAttribute('hidden');
    setBanner(name, configured?'NO PRIVATE BUILD':'PRIVATE CONNECTION PENDING', configured?'none':'loading');
    const p=document.getElementById('privateNoBuildText'); if(p) p.textContent=configured?`${name} does not currently have a dedicated Private Bound build. Request one to unlock server-only systems and private database-backed modules.`:'The private dashboard database connection has not been configured on Vercel yet. The public dashboard remains available.';
  }
  function renderBuild(build, name) {
    document.getElementById('privateNoBuild')?.setAttribute('hidden',''); document.getElementById('privateBuildArea')?.removeAttribute('hidden');
    setBanner(name, build.premium?'PRIVATE BUILD • PREMIUM':'PRIVATE BUILD', 'active');
    const display=build.display_name||name; ['privateBuildName','privatePreviewName'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=display});
    const modules=Object.entries(build.modules||{}).filter(([k,v])=>v && MODULES[k]);
    const grid=document.getElementById('privateModuleGrid'); if(grid) grid.innerHTML=modules.map(([k])=>{const m=MODULES[k];return `<article class="private-module"><span class="private-module-icon">${m.icon}</span><small>${m.label}</small><h4>${m.title}</h4><p>${m.desc}</p><strong>ENABLED</strong></article>`}).join('') || '<article class="private-module"><h4>No modules assigned yet.</h4></article>';
    const mini=document.getElementById('privateMiniNav'); if(mini) mini.innerHTML=['overview',...modules.map(([k])=>k)].slice(0,7).map((k,i)=>`<span${i===0?' class="active"':''}>${k.charAt(0).toUpperCase()+k.slice(1)}</span>`).join('');
    const s=build.stats||{};
    const metricRows=[];
    if(build.modules?.tickets) metricRows.push(['OPEN TICKETS',s.tickets?.open??0]);
    if(build.modules?.staff) metricRows.push(['STAFF LIVE',s.staff?.active_shifts??0]);
    if(build.modules?.economy) metricRows.push(['BONDS',compact(s.economy?.total_nugs)]);
    if(build.modules?.subscriptions) metricRows.push(['SUBSCRIBERS',s.subscriptions?.active??0]);
    if(build.modules?.moderation) metricRows.push(['MOD CASES',s.moderation?.cases??0]);
    const mm=document.getElementById('privateMiniMetrics'); if(mm) mm.innerHTML=metricRows.slice(0,3).map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('');
    const feed=document.getElementById('privateMiniFeed'); if(feed) feed.innerHTML=modules.slice(0,3).map(([k])=>{const m=MODULES[k];return `<div><i>${m.icon}</i><span><b>${m.title}</b><small>${m.label.toLowerCase()}</small></span><em>LIVE</em></div>`}).join('');
    const ds=document.getElementById('privateDataStats'); if(ds) ds.innerHTML=metricRows.slice(0,6).map(([a,b])=>`<div><b>${b}</b><small>${a.toLowerCase()}</small></div>`).join('');
    const list=document.getElementById('privateBuildList'); if(list) list.innerHTML=modules.map(([k],i)=>{const m=MODULES[k];return `<div class="private-build-row"><span>${String(i+1).padStart(2,'0')}</span><div><b>${m.title}</b><small>${m.desc}</small></div><em>PRIVATE</em></div>`}).join('');
    const crumb=document.getElementById('privateMiniCrumb'); if(crumb) crumb.textContent=`${display.toUpperCase()} / PRIVATE BUILD`;
    const title=document.getElementById('privateDataTitle'); if(title) title.textContent=`${display}'s private stack.`;
  }
  async function refreshPrivateBuild() {
    const guildId=selectedGuildId(), name=selectedGuildName();
    if(!guildId){ renderNoBuild(name,true); setBanner(name,'CHOOSE A SERVER','none'); return; }
    setBanner(name,'CHECKING PRIVATE BUILD','loading');
    const access=authTokenFromStorage(), provider=providerToken();
    if(!access || !provider){ renderNoBuild(name,false); return; }
    try {
      const r=await fetch(`/api/private?guild_id=${encodeURIComponent(guildId)}`,{headers:{Authorization:`Bearer ${access}`,'X-Discord-Provider-Token':provider}});
      const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.error||`Private dashboard failed (${r.status})`);
      if(d.private_build) renderBuild(d.private_build,d.guild?.name||name); else renderNoBuild(d.guild?.name||name,d.configured!==false);
    } catch(e){ console.error(e); renderNoBuild(name,false); }
  }

  function openPrivate() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-private')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'private'));
    const title = document.getElementById('pageTitle'); if (title) title.textContent = 'Private Bound';
    const crumb = document.querySelector('.topbar-left small'); if (crumb) crumb.textContent = 'BOUND / PRIVATE BUILDS';
    document.getElementById('sidebar')?.classList.remove('open');
    sessionStorage.setItem('bound_open_private', '1'); history.replaceState(null, '', '#private');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void refreshPrivateBuild();
  }

  document.querySelector('[data-view="private"]')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); openPrivate(); });
  document.addEventListener('click', e=>{ if(e.target?.closest?.('.server-option') && document.getElementById('view-private')?.classList.contains('active')) setTimeout(()=>void refreshPrivateBuild(),150); });
  document.getElementById('privateExploreBtn')?.addEventListener('click', () => document.getElementById('privateModules')?.scrollIntoView({ behavior: 'smooth' }));
  document.getElementById('privatePreviewBtn')?.addEventListener('click', () => document.getElementById('privatePossibilities')?.scrollIntoView({ behavior: 'smooth' }));
  const serverName=document.getElementById('serverName'); if(serverName) new MutationObserver(()=>{if(document.getElementById('view-private')?.classList.contains('active'))void refreshPrivateBuild()}).observe(serverName,{childList:true,subtree:true,characterData:true});

  document.querySelectorAll('.nav-item:not([data-view="private"])').forEach(btn => btn.addEventListener('click', () => { const crumb = document.querySelector('.topbar-left small'); if (crumb) crumb.textContent = 'BOUND / CONTROL CENTRE'; sessionStorage.removeItem('bound_open_private'); if (location.hash === '#private') history.replaceState(null, '', location.pathname); }));
  if (wantsPrivate) setTimeout(openPrivate, 0);
})();