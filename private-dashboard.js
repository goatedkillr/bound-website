(() => {
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'private-dashboard.css';
  document.head.appendChild(css);

  // The profile/RP showcase files already exist, but were never actually
  // loaded by dashboard.html. Load them here so the two flagship pages use
  // their real data-driven designs instead of the generic fallback cards.
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
    if (settingsLabel) {
      nav.insertBefore(privateLabel, settingsLabel);
      nav.insertBefore(btn, settingsLabel);
    } else {
      nav.append(privateLabel, btn);
    }
  }

  const content = document.querySelector('.dashboard-content');
  if (content && !document.getElementById('view-private')) {
    const section = document.createElement('section');
    section.className = 'view private-view';
    section.id = 'view-private';
    section.innerHTML = `
      <div class="private-hero">
        <div>
          <span class="private-kicker"><i></i> PRIVATE SERVER EDITION</span>
          <h2>Bound, rebuilt around <span>your community.</span></h2>
          <p>Take the systems behind Bound and turn them into a server-specific operating system: custom staff workflows, premium roles, advanced tickets, moderation, automations, economy features and bespoke tools designed around how your community actually runs.</p>
          <div class="private-actions">
            <a class="private-primary" href="https://discord.gg/NVseqMDNRd" target="_blank" rel="noopener noreferrer">Request a private build ↗</a>
            <button class="private-secondary" id="privateExploreBtn">Explore the stack ↓</button>
          </div>
          <div class="private-proof">
            <div><b>Server-specific</b><span>Built around your roles</span></div>
            <div><b>Modular</b><span>Choose what you need</span></div>
            <div><b>Connected</b><span>One Bound ecosystem</span></div>
          </div>
        </div>
        <div class="private-preview">
          <div class="private-preview-top"><div class="private-preview-title"><span class="private-preview-logo">B</span><div><b>Private Bound</b><small>SERVER CONTROL CENTRE</small></div></div><span class="private-tag">LIVE PREVIEW</span></div>
          <div class="private-preview-shell">
            <div class="private-mini-nav"><span>Overview</span><span>Staff HQ</span><span>Tickets</span><span>Economy</span><span>Subscriptions</span><span>Moderation</span></div>
            <div class="private-mini-main"><div class="private-mini-head"><small>YOUR SERVER / PRIVATE BUILD</small><b>Everything in one place.</b></div><div class="private-mini-metrics"><div><small>STAFF</small><b>Clocking + roles</b></div><div><small>SUPPORT</small><b>Smart tickets</b></div><div><small>PREMIUM</small><b>Custom perks</b></div></div><div class="private-mini-feed"><div><i>◆</i><span><b>Safety workflows</b><small>Isolation, review and protection</small></span><em>READY</em></div><div><i>▱</i><span><b>Ticket operations</b><small>Claims, transcripts and ratings</small></span><em>SYNCED</em></div><div><i>♙</i><span><b>Staff automation</b><small>Clocking, breaks and assignments</small></span><em>AUTO</em></div></div></div>
          </div>
        </div>
      </div>

      <div class="private-section-head" id="privateModules"><div><small>BUILD YOUR VERSION</small><h3>Pick the systems. Make them yours.</h3></div><p>Private builds can reuse proven Bound systems or go further with server-only commands, custom data, branded flows and automation that never needs to exist globally.</p></div>
      <div class="private-modules">
        <article class="private-module"><strong>POPULAR</strong><span class="private-module-icon">♙</span><small>STAFF OPERATIONS</small><h4>Run your team properly.</h4><p>Clock in/out, temporary staff roles, breaks, assignments, performance stats and automatic unassignment.</p></article>
        <article class="private-module"><span class="private-module-icon">▱</span><small>TICKETS & SUPPORT</small><h4>Support that feels custom.</h4><p>Multiple panels, custom questions, verification tickets, claims, transcripts, ratings and staff tracking.</p></article>
        <article class="private-module"><span class="private-module-icon">₦</span><small>SERVER ECONOMY</small><h4>Your own economy loop.</h4><p>Custom currency, work, fishing, hunting, robberies, heists, shops, perks and server-specific progression.</p></article>
        <article class="private-module"><strong>PREMIUM</strong><span class="private-module-icon">✦</span><small>SUBSCRIPTIONS</small><h4>Make premium feel premium.</h4><p>Personal roles, giveable roles, perks, subscriber panels, autoresponders and custom premium experiences.</p></article>
        <article class="private-module"><span class="private-module-icon">⌁</span><small>MODERATION</small><h4>Moderation built for your rules.</h4><p>Cases, warnings, configurable DMs, jail flows, private isolation, logging and server-only moderation controls.</p></article>
        <article class="private-module"><span class="private-module-icon">⚙</span><small>AUTOMATION</small><h4>Remove the repetitive work.</h4><p>AFK, levels, auto roles, auto threads, auto reactions, scheduled role cleanup and custom event-driven workflows.</p></article>
      </div>

      <div class="private-case">
        <article class="private-case-copy"><span class="private-kicker"><i></i> REAL BUILD BLUEPRINT</span><h3>The Dark Side-style stack.</h3><p>A private Bound deployment can combine community operations, moderation, economy, subscriptions and support into one cohesive server-specific system while staying connected to the wider Bound ecosystem.</p><div class="private-case-stats"><div><b>One bot</b><small>shared identity</small></div><div><b>Server scoped</b><small>private data + logic</small></div><div><b>Expandable</b><small>new modules anytime</small></div></div></article>
        <article class="private-build-list"><div class="private-build-row"><span>01</span><div><b>Staff control centre</b><small>Clocking, breaks, jobs, temporary access</small></div><em>PRIVATE</em></div><div class="private-build-row"><span>02</span><div><b>Advanced support stack</b><small>Tickets, verification, transcripts, ratings</small></div><em>CONNECTED</em></div><div class="private-build-row"><span>03</span><div><b>Premium subscriptions</b><small>Personal roles, giveable roles, perks, panels</small></div><em>BRANDED</em></div><div class="private-build-row"><span>04</span><div><b>Deep moderation</b><small>Cases, custom notices, jail and isolation</small></div><em>CONTROLLED</em></div><div class="private-build-row"><span>05</span><div><b>Custom economy & utilities</b><small>Currency, shops, games, AFK, levels and more</small></div><em>MODULAR</em></div></article>
      </div>

      <div class="private-upgrade"><div><span class="private-kicker">YOUR SERVER, YOUR VERSION</span><h3>Want Bound to do something nobody else gets?</h3><p>Private builds are scoped around the community. Bring the workflow, role structure or feature idea and Bound Society can map it into a custom system.</p></div><div class="private-actions"><a class="private-primary" href="https://discord.gg/NVseqMDNRd" target="_blank" rel="noopener noreferrer">Talk to Bound Society ↗</a></div></div>`;
    content.appendChild(section);
  }

  function openPrivate() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-private')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === 'private'));
    const title = document.getElementById('pageTitle');
    if (title) title.textContent = 'Private Bound';
    const crumb = document.querySelector('.topbar-left small');
    if (crumb) crumb.textContent = 'BOUND / PRIVATE BUILDS';
    document.getElementById('sidebar')?.classList.remove('open');
    sessionStorage.setItem('bound_open_private', '1');
    history.replaceState(null, '', '#private');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelector('[data-view="private"]')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    openPrivate();
  });
  document.getElementById('privateExploreBtn')?.addEventListener('click', () => document.getElementById('privateModules')?.scrollIntoView({ behavior: 'smooth' }));

  document.querySelectorAll('.nav-item:not([data-view="private"])').forEach(btn => btn.addEventListener('click', () => {
    const crumb = document.querySelector('.topbar-left small');
    if (crumb) crumb.textContent = 'BOUND / CONTROL CENTRE';
    sessionStorage.removeItem('bound_open_private');
    if (location.hash === '#private') history.replaceState(null, '', location.pathname);
  }));

  if (wantsPrivate) setTimeout(openPrivate, 0);
})();
