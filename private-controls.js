(() => {
  const MODULES = [
    ['staff','Staff operations','Clocking, breaks, assignments and staff tools'],
    ['tickets','Tickets & support','Panels, claims, transcripts and ratings'],
    ['economy','Economy','Currency, work, games, shops and balances'],
    ['subscriptions','Subscriptions','VIP, Filthy and Plus subscriber systems'],
    ['moderation','Moderation','Warnings, mutes, jail, cases and moderation DMs'],
    ['automation','Automation','Auto channels, reactions and workflow tools'],
    ['safety','Safety','Private safety and containment controls'],
    ['levels','Levels','XP, rewards and level progression'],
    ['afk','AFK','AFK tracking and return notifications'],
    ['logging','Logging','Private server audit and event logging'],
  ];
  let current = null;
  const guildId = () => localStorage.getItem('bound_dashboard_guild') || '';
  function authToken(){ for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{const v=JSON.parse(localStorage.getItem(k)||'null');const t=v?.access_token||v?.currentSession?.access_token;if(t)return t}catch{}} return null; }
  const providerToken = () => sessionStorage.getItem('bound_discord_provider_token') || localStorage.getItem('bound_discord_provider_token_backup') || null;
  async function request(method='GET', body){const id=guildId(),access=authToken(),provider=providerToken();if(!id||!access||!provider)throw new Error('Private dashboard session is not ready.');const r=await fetch(`/api/private?guild_id=${encodeURIComponent(id)}`,{method,headers:{Authorization:`Bearer ${access}`,'X-Discord-Provider-Token':provider,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Private dashboard failed (${r.status})`);return d;}
  function ensurePanel(){const area=document.getElementById('privateBuildArea');if(!area||document.getElementById('privateControlCentre'))return;const panel=document.createElement('section');panel.id='privateControlCentre';panel.className='private-control-centre';panel.innerHTML=`
    <div class="private-control-head"><div><small>PRIVATE SERVER BUILDER</small><h3>Build this server your way.</h3><p>Everything here is server scoped. Changes only affect the selected approved premium server.</p></div><span class="private-control-save" id="privateControlSaveState">SYNCED</span></div>
    <div class="private-control-layout">
      <article class="private-control-card"><div class="private-control-title"><span>✦</span><div><small>BRANDING</small><h4>Bot identity</h4></div></div><label><span>Bot display name<small>How the private build is presented in this server.</small></span><input id="privateBotName" maxlength="32" placeholder="Bound"></label><label><span>Avatar URL<small>HTTPS PNG JPG or GIF URL</small></span><input id="privateBotAvatar" maxlength="1000" placeholder="https://..."></label><label><span>Command prefix<small>Optional private text command prefix</small></span><input id="privatePrefix" maxlength="8" placeholder="tds"></label></article>
      <article class="private-control-card"><div class="private-control-title"><span>₦</span><div><small>ECONOMY BRAND</small><h4>Make Nugs yours</h4></div></div><label><span>Currency name<small>Rename Nugs to whatever fits the server</small></span><input id="privateCurrencyName" maxlength="24" placeholder="Nugs"></label><label><span>Currency icon or emoji<small>Unicode emoji or Discord custom emoji markup</small></span><input id="privateCurrencyIcon" maxlength="100" placeholder="💰"></label><div class="currency-preview"><small>PREVIEW</small><b id="privateCurrencyPreview">💰 12,500 Nugs</b></div></article>
    </div>
    <div class="private-control-card private-module-controls"><div class="private-control-title"><span>⚙</span><div><small>FEATURE SWITCHBOARD</small><h4>Enable or disable private systems</h4></div></div><div class="private-toggle-grid" id="privateToggleGrid"></div></div>
    <div class="private-control-footer"><span>Only the server owner or Discord Administrators can save controls on an approved premium server</span><button id="privateSaveControls">Save private build</button></div>`;
    area.insertBefore(panel,area.children[1]||null);
    const grid=document.getElementById('privateToggleGrid');if(grid)grid.innerHTML=MODULES.map(([key,title,desc])=>`<button class="private-module-toggle" data-private-module="${key}" aria-pressed="true"><span><b>${title}</b><small>${desc}</small></span><i></i></button>`).join('');
    document.querySelectorAll('[data-private-module]').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle('off');b.setAttribute('aria-pressed',String(!b.classList.contains('off')));markDirty()}));
    ['privateBotName','privateBotAvatar','privatePrefix','privateCurrencyName','privateCurrencyIcon'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{markDirty();updatePreview()}));
    document.getElementById('privateSaveControls')?.addEventListener('click',save);
  }
  function markDirty(){const e=document.getElementById('privateControlSaveState');if(e){e.textContent='UNSAVED';e.classList.add('dirty')}}
  function updatePreview(){const n=document.getElementById('privateCurrencyName')?.value.trim()||'Nugs',i=document.getElementById('privateCurrencyIcon')?.value.trim()||'💰',p=document.getElementById('privateCurrencyPreview');if(p)p.textContent=`${i} 12,500 ${n}`}
  function hydrate(build){ensurePanel();current=build;const c=build.control||{};const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v||''};set('privateBotName',c.bot_display_name||build.display_name||'');set('privateBotAvatar',c.bot_avatar_url);set('privatePrefix',c.command_prefix);set('privateCurrencyName',c.currency_name||'Nugs');set('privateCurrencyIcon',c.currency_icon||'💰');document.querySelectorAll('[data-private-module]').forEach(b=>{const on=(c.modules||build.modules||{})[b.dataset.privateModule]!==false;b.classList.toggle('off',!on);b.setAttribute('aria-pressed',String(on))});updatePreview();const s=document.getElementById('privateControlSaveState');if(s){s.textContent='SYNCED';s.classList.remove('dirty')}}
  async function save(){const btn=document.getElementById('privateSaveControls');if(!btn)return;btn.disabled=true;btn.textContent='Saving…';try{const modules={};document.querySelectorAll('[data-private-module]').forEach(b=>modules[b.dataset.privateModule]=!b.classList.contains('off'));const body={modules,currency_name:document.getElementById('privateCurrencyName')?.value||'Nugs',currency_icon:document.getElementById('privateCurrencyIcon')?.value||'💰',bot_display_name:document.getElementById('privateBotName')?.value||'',bot_avatar_url:document.getElementById('privateBotAvatar')?.value||'',command_prefix:document.getElementById('privatePrefix')?.value||''};const d=await request('PATCH',body);if(current)current.control=d.control;const s=document.getElementById('privateControlSaveState');if(s){s.textContent='SAVED';s.classList.remove('dirty')}setTimeout(()=>{if(s)s.textContent='SYNCED'},1400)}catch(e){const s=document.getElementById('privateControlSaveState');if(s){s.textContent='SAVE FAILED';s.classList.add('dirty')}console.error(e)}finally{btn.disabled=false;btn.textContent='Save private build'}}
  async function refresh(){if(!document.getElementById('view-private')?.classList.contains('active'))return;try{const d=await request();if(d.entitled&&d.private_build)hydrate(d.private_build);else{current=null;document.getElementById('privateControlCentre')?.remove()}}catch(e){console.error(e);current=null;document.getElementById('privateControlCentre')?.remove()}}
  const observer=new MutationObserver(()=>{if(document.getElementById('view-private')?.classList.contains('active'))setTimeout(refresh,80)});observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('.server-option')){current=null;document.getElementById('privateControlCentre')?.remove();return}
    if(e.target?.closest?.('[data-view="private"]'))setTimeout(refresh,180)
  });
  setTimeout(refresh,400);
})();