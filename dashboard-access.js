(() => {
  const views = [
    ['overview','Overview','⌂'],
    ['profile','My Bound Profile','◉'],
    ['servers','Servers','◇'],
    ['safety','Safety and Consent','◆'],
    ['moderation','Moderation','⌁'],
    ['tickets','Tickets and Support','▱'],
    ['economy','Factions','⛓'],
    ['staff','Staff','♙'],
    ['roleplay','Social and RP','♡'],
    ['logs','Audit Log','≣'],
    ['settings','Server Settings','⚙'],
    ['private','Private Bound','✦'],
  ];

  const style = document.createElement('style');
  style.textContent = `
    .quick-launch-btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.09);border-radius:11px;background:rgba(255,255,255,.04);color:#eee7f0;font:600 12px Inter,sans-serif;cursor:pointer}.quick-launch-btn kbd{font:700 10px Inter,sans-serif;color:#a89daf;background:rgba(255,255,255,.06);border-radius:6px;padding:3px 5px}.bound-palette{position:fixed;inset:0;z-index:9999;display:grid;place-items:start center;padding-top:min(14vh,110px);background:rgba(7,5,9,.72);backdrop-filter:blur(12px)}.bound-palette[hidden]{display:none}.bound-palette-card{width:min(620px,calc(100vw - 24px));max-height:72vh;overflow:hidden;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:#120e15;box-shadow:0 28px 90px rgba(0,0,0,.5)}.bound-palette-search{display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid rgba(255,255,255,.07)}.bound-palette-search span{color:#9d8fa5}.bound-palette-search input{width:100%;border:0;outline:0;background:none;color:#fff;font:600 15px Inter,sans-serif}.bound-palette-results{padding:8px;overflow:auto;max-height:58vh}.bound-palette-item{width:100%;display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:10px;padding:10px;border:0;border-radius:11px;background:transparent;color:#eee7f0;text-align:left;cursor:pointer}.bound-palette-item:hover,.bound-palette-item.active{background:rgba(205,171,255,.09)}.bound-palette-item>span{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:rgba(255,255,255,.05)}.bound-palette-item b{font-size:12px}.bound-palette-item small{color:#8f8394;font-size:10px}.bound-palette-empty{padding:22px;text-align:center;color:#8f8394;font-size:12px}.mobile-quickbar{display:none}@media(max-width:760px){.quick-launch-btn{width:36px;padding:0;justify-content:center}.quick-launch-btn b,.quick-launch-btn kbd{display:none}.mobile-quickbar{position:fixed;z-index:800;left:10px;right:10px;bottom:10px;display:grid;grid-template-columns:repeat(4,1fr);padding:6px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(17,13,20,.94);backdrop-filter:blur(18px);box-shadow:0 18px 50px rgba(0,0,0,.38)}.mobile-quickbar button{border:0;background:transparent;color:#9f93a5;padding:7px 4px;border-radius:10px;font:600 9px Inter,sans-serif}.mobile-quickbar button span{display:block;color:#eee7f0;font-size:15px;margin-bottom:2px}.mobile-quickbar button.active{background:rgba(205,171,255,.1);color:#d9c8ef}.dashboard-content{padding-bottom:86px!important}}
  `;
  document.head.appendChild(style);

  function navButton(key){ return document.querySelector(`.nav-item[data-view="${key}"]`); }
  function openView(key){ const button=navButton(key); if(button){ button.click(); localStorage.setItem('bound_dashboard_view',key); return true; } return false; }

  function addLauncher(){
    const host=document.querySelector('.topbar-actions');
    if(!host || document.getElementById('quickLaunchBtn')) return;
    const btn=document.createElement('button');
    btn.id='quickLaunchBtn'; btn.className='quick-launch-btn'; btn.type='button';
    btn.innerHTML='<span>⌕</span><b>Quick access</b><kbd>Ctrl K</kbd>';
    host.insertBefore(btn, host.firstChild);
    btn.addEventListener('click',()=>openPalette());
  }

  function addPalette(){
    if(document.getElementById('boundPalette')) return;
    const wrap=document.createElement('div'); wrap.id='boundPalette'; wrap.className='bound-palette'; wrap.hidden=true;
    wrap.innerHTML='<div class="bound-palette-card"><div class="bound-palette-search"><span>⌕</span><input id="boundPaletteInput" autocomplete="off" placeholder="Go anywhere in Bound"></div><div class="bound-palette-results" id="boundPaletteResults"></div></div>';
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{ if(e.target===wrap) closePalette(); });
    document.getElementById('boundPaletteInput')?.addEventListener('input',renderPalette);
  }

  function availableViews(){ return views.filter(([key])=>navButton(key)); }
  function renderPalette(){
    const input=document.getElementById('boundPaletteInput'); const out=document.getElementById('boundPaletteResults'); if(!out) return;
    const q=(input?.value||'').trim().toLowerCase();
    const filtered=availableViews().filter(([,label])=>!q || label.toLowerCase().includes(q));
    out.innerHTML=filtered.length?filtered.map(([key,label,icon],i)=>`<button class="bound-palette-item${i===0?' active':''}" data-palette-view="${key}"><span>${icon}</span><div><b>${label}</b><small>Open ${label.toLowerCase()}</small></div><small>↵</small></button>`).join(''):'<div class="bound-palette-empty">Nothing found</div>';
    out.querySelectorAll('[data-palette-view]').forEach(btn=>btn.addEventListener('click',()=>{openView(btn.dataset.paletteView);closePalette()}));
  }
  function openPalette(){ addPalette(); const p=document.getElementById('boundPalette'); if(!p)return; p.hidden=false; renderPalette(); requestAnimationFrame(()=>document.getElementById('boundPaletteInput')?.focus()); }
  function closePalette(){ const p=document.getElementById('boundPalette'); if(p)p.hidden=true; }

  function addMobileBar(){
    if(document.getElementById('mobileQuickbar')) return;
    const bar=document.createElement('div'); bar.className='mobile-quickbar'; bar.id='mobileQuickbar';
    bar.innerHTML=`<button data-mobile-view="overview"><span>⌂</span>Home</button><button data-mobile-view="tickets"><span>▱</span>Tickets</button><button data-mobile-view="private"><span>✦</span>Private</button><button data-mobile-view="settings"><span>⚙</span>Settings</button>`;
    document.body.appendChild(bar);
    bar.querySelectorAll('[data-mobile-view]').forEach(btn=>btn.addEventListener('click',()=>openView(btn.dataset.mobileView)));
    syncMobile();
  }
  function syncMobile(){
    const active=document.querySelector('.nav-item.active')?.dataset.view;
    document.querySelectorAll('[data-mobile-view]').forEach(b=>b.classList.toggle('active',b.dataset.mobileView===active));
  }

  function restoreView(){
    const fromHash=location.hash.replace('#','');
    const saved=localStorage.getItem('bound_dashboard_view');
    const wanted=fromHash==='private'?'private':saved;
    if(!wanted || wanted==='overview') return;
    let tries=0; const timer=setInterval(()=>{tries++; if(openView(wanted)||tries>20)clearInterval(timer)},150);
  }

  document.addEventListener('click',e=>{const btn=e.target.closest?.('.nav-item[data-view]');if(btn){localStorage.setItem('bound_dashboard_view',btn.dataset.view);setTimeout(syncMobile,0)}});
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();const p=document.getElementById('boundPalette');p&&!p.hidden?closePalette():openPalette();return}
    if(e.key==='Escape') closePalette();
    const p=document.getElementById('boundPalette'); if(!p||p.hidden) return;
    const items=[...document.querySelectorAll('.bound-palette-item')]; if(!items.length)return;
    let i=Math.max(0,items.findIndex(x=>x.classList.contains('active')));
    if(e.key==='ArrowDown'){e.preventDefault();items[i].classList.remove('active');i=(i+1)%items.length;items[i].classList.add('active');items[i].scrollIntoView({block:'nearest'})}
    if(e.key==='ArrowUp'){e.preventDefault();items[i].classList.remove('active');i=(i-1+items.length)%items.length;items[i].classList.add('active');items[i].scrollIntoView({block:'nearest'})}
    if(e.key==='Enter'){e.preventDefault();items[i].click()}
  });

  const arm=()=>{addLauncher();addPalette();addMobileBar();restoreView()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm);else arm();
})();