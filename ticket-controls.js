(() => {
  const DARK_SIDE_ID='1222024653795496006';
  let loadedGuild='';
  let configState=null;

  const guildId=()=>localStorage.getItem('bound_dashboard_guild')||'';
  const providerToken=()=>sessionStorage.getItem('bound_discord_provider_token')||localStorage.getItem('bound_discord_provider_token_backup')||'';
  function authToken(){for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{const v=JSON.parse(localStorage.getItem(k)||'null');const t=v?.access_token||v?.currentSession?.access_token;if(t)return t}catch{}}return null;}
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>Number(v||0).toLocaleString('en-GB');

  function host(){return document.getElementById('ticketPremiumSurface');}
  function builderHost(){return document.getElementById('view-tickets')?.querySelector('.finish-shell')||null;}
  function stat(label,value,copy){return `<article class="finish-card"><small>${label}</small><h3>${value}</h3><p>${copy}</p></article>`;}
  function loading(copy='Loading live ticket data'){const h=host();if(h)h.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">LIVE TICKET NETWORK</span><h3>${copy}</h3><p>Bound is reading the latest private ticket totals.</p></div></div>`;}

  async function previewRequest(){
    const access=authToken();
    if(!access)throw new Error('Sign in to view live ticket data');
    const id=guildId();
    const headers={Authorization:`Bearer ${access}`};
    const provider=providerToken();
    if(provider)headers['X-Discord-Provider-Token']=provider;
    const url=id?`/api/tickets?mode=preview&guild_id=${encodeURIComponent(id)}`:'/api/tickets?mode=preview';
    const r=await fetch(url,{headers});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(d.error||`Ticket preview failed (${r.status})`);e.status=r.status;throw e;}
    return d;
  }

  async function configRequest(method='GET',body){
    const id=guildId(),access=authToken(),provider=providerToken();
    if(!id||!access)throw new Error('Choose a server and sign in first');
    if(!provider)throw new Error('Refresh Discord before changing ticket settings');
    const r=await fetch(`/api/tickets?mode=config&guild_id=${encodeURIComponent(id)}`,{method,headers:{Authorization:`Bearer ${access}`,'X-Discord-Provider-Token':provider,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){const e=new Error(d.error||`Ticket settings failed (${r.status})`);e.status=r.status;throw e;}
    return d;
  }

  function renderStats(data){
    const h=host();if(!h)return;
    const s=data.stats||{};
    if(data.premium){
      h.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">PREMIUM TICKET HQ</span><h3>${esc(data.guild?.name||'This server')} is live</h3><p>These are the selected server's live ticket totals. Premium settings are editable below.</p></div><span class="finish-state">PREMIUM</span></div><div class="finish-grid">${stat('TOTAL TICKETS',fmt(s.total),'All tickets created')}${stat('OPEN NOW',fmt(s.open),'Currently active')}${stat('CLAIMED',fmt(s.claimed),'Open tickets with staff')}${stat('AVERAGE RATING',s.average_rating?`${s.average_rating} / 5`:'No ratings yet',`${fmt(s.rated)} completed ratings`)}</div><div class="finish-grid">${stat('SUPPORT',fmt(s.support),'Support tickets')}${stat('ID VERIFIED',fmt(s.id_verify),'ID verification tickets')}${stat('CROSS VERIFIED',fmt(s.cross_verify),'Cross verification tickets')}${stat('CLOSED',fmt(s.closed),'Successfully closed tickets')}</div><div class="finish-security"><i></i> Live server data • permission checked • premium controls enabled</div>`;
    }else{
      h.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">LIVE PRIVATE BUILD PREVIEW</span><h3>The Dark Side ticket system</h3><p>This server is not premium yet so you are seeing safe live aggregate stats from The Dark Side <code>${DARK_SIDE_ID}</code>.</p></div><span class="finish-state locked">PREVIEW</span></div><div class="finish-grid">${stat('TOTAL TICKETS',fmt(s.total),'Real private build tickets')}${stat('OPEN NOW',fmt(s.open),'Currently active')}${stat('CLAIMED',fmt(s.claimed),'Being handled by staff')}${stat('AVERAGE RATING',s.average_rating?`${s.average_rating} / 5`:'No ratings yet',`${fmt(s.rated)} completed ratings`)}</div><div class="finish-grid">${stat('SUPPORT',fmt(s.support),'Support flow usage')}${stat('ID VERIFIED',fmt(s.id_verify),'ID verification flow usage')}${stat('CROSS VERIFIED',fmt(s.cross_verify),'Cross verification flow usage')}${stat('CLOSED',fmt(s.closed),'Completed tickets')}</div><div class="finish-grid"><article class="finish-card wide"><span class="finish-state">PRIVATE BUILD</span><div class="finish-icon">▱</div><small>WHAT PREMIUM UNLOCKS</small><h3>Your own ticket control centre</h3><p>Edit support and verification panels, questions, channels, staff role, ratings, internal ticket messages and appearance directly from the dashboard.</p></article><article class="finish-card"><span class="finish-state">LIVE</span><div class="finish-icon">★</div><small>THREE REAL FLOWS</small><h3>Support • ID • Cross</h3><p>Separate ticket types and rating experiences with written feedback and last-claimer attribution.</p></article></div>`;
      hideBuilder();
    }
  }

  function ensureBuilder(){
    const parent=builderHost();if(!parent)return null;
    let el=document.getElementById('ticketBuilder');if(el)return el;
    el=document.createElement('section');el.id='ticketBuilder';el.className='ticket-builder';el.innerHTML=`<div class="ticket-builder-head"><div><small>PREMIUM TICKET BUILDER</small><h3>Control this server's ticket system</h3><p>Everything below is scoped to the selected premium server.</p></div><span class="ticket-save-state" id="ticketSaveState">SYNCED</span></div><div class="ticket-tabbar"><button class="active" data-ticket-tab="setup">Setup</button><button data-ticket-tab="support">Support</button><button data-ticket-tab="verify">Verification</button><button data-ticket-tab="rating">Ratings</button><button data-ticket-tab="internal">Ticket messages</button></div><div class="ticket-pane active" data-ticket-pane="setup"></div><div class="ticket-pane" data-ticket-pane="support"></div><div class="ticket-pane" data-ticket-pane="verify"></div><div class="ticket-pane" data-ticket-pane="rating"></div><div class="ticket-pane" data-ticket-pane="internal"></div><div class="ticket-builder-footer"><span>Changes require current Discord admin permission and active premium.</span><button class="ticket-save" id="ticketSave">Save ticket system</button></div>`;
    parent.appendChild(el);
    el.querySelectorAll('[data-ticket-tab]').forEach(b=>b.addEventListener('click',()=>{el.querySelectorAll('[data-ticket-tab]').forEach(x=>x.classList.toggle('active',x===b));el.querySelectorAll('[data-ticket-pane]').forEach(x=>x.classList.toggle('active',x.dataset.ticketPane===b.dataset.ticketTab));}));
    el.addEventListener('input',dirty);
    document.getElementById('ticketSave')?.addEventListener('click',save);
    return el;
  }
  function hideBuilder(){const el=document.getElementById('ticketBuilder');if(el)el.hidden=true;}
  function field(id,label,value='',small='',area=false){return `<label class="ticket-field"><span>${label}</span>${small?`<small>${small}</small>`:''}${area?`<textarea id="${id}" maxlength="1800">${esc(value)}</textarea>`:`<input id="${id}" value="${esc(value)}">`}</label>`;}
  function questions(prefix,arr=[]){return [0,1,2,3,4].map((_,i)=>field(`${prefix}Q${i+1}`,`Question ${i+1}`,arr[i]||'',i===0?'Blank questions are ignored':'')).join('');}
  function v(id){return document.getElementById(id)?.value?.trim()||'';}
  function q(prefix){return [1,2,3,4,5].map(i=>v(`${prefix}Q${i}`)).filter(Boolean);}
  function dirty(){const s=document.getElementById('ticketSaveState');if(s){s.textContent='UNSAVED';s.classList.add('dirty')}}
  function clean(){const s=document.getElementById('ticketSaveState');if(s){s.textContent='SYNCED';s.classList.remove('dirty')}}

  function renderBuilder(data){
    const el=ensureBuilder();if(!el)return;el.hidden=false;configState=data;
    const s=data.settings||{},sp=data.panels?.support||{},vp=data.panels?.verify||{};
    el.querySelector('[data-ticket-pane="setup"]').innerHTML=`<div class="ticket-grid"><article class="ticket-card"><small>DESTINATIONS</small><h4>Channels and staff</h4>${field('tcCategory','Ticket category ID',s.category_id)}${field('tcLog','Log channel ID',s.log_channel_id)}${field('tcStaff','Staff role ID',s.staff_role_id)}${field('tcRating','Support rating channel ID',s.rating_channel_id)}${field('tcVerifyRating','Verification rating channel ID',s.verification_rating_channel_id)}</article><article class="ticket-card"><small>STYLE</small><h4>Shared appearance</h4>${field('tcColor','Embed colour',s.embed_color||'#FFD84D','Use a 6 digit hex colour')}</article></div>`;
    el.querySelector('[data-ticket-pane="support"]').innerHTML=`<div class="ticket-grid"><article class="ticket-card"><small>SUPPORT PANEL</small><h4>Public support panel</h4>${field('spTitle','Panel title',sp.title)}${field('spDesc','Panel description',sp.description,'Shown before a member opens a ticket',true)}${field('spButton','Button label',sp.button_label)}${field('spImage','Image URL',sp.image_url)}</article><article class="ticket-card full"><small>SUPPORT FORM</small><h4>Questions</h4>${questions('sp',sp.questions)}</article></div>`;
    el.querySelector('[data-ticket-pane="verify"]').innerHTML=`<div class="ticket-grid"><article class="ticket-card"><small>VERIFICATION PANEL</small><h4>ID and cross verification</h4>${field('vpTitle','Panel title',vp.title)}${field('vpDesc','Panel description',vp.description,'Explain both verification routes',true)}${field('vpButton','Primary button label',vp.button_label)}${field('vpImage','Image URL',vp.image_url)}</article><article class="ticket-card full"><small>VERIFICATION FORM</small><h4>Questions</h4>${questions('vp',vp.questions)}</article></div>`;
    el.querySelector('[data-ticket-pane="rating"]').innerHTML=`<div class="ticket-grid"><article class="ticket-card"><small>RATING EXPERIENCE</small><h4>After ticket close</h4>${field('rtTitle','Rating title',s.rating_title,'Supports {staff_name}')}${field('rtDesc','Rating description',s.rating_description,'Supports {ticket_id} and {staff}',true)}${field('rtFooter','Footer',s.rating_footer)}${field('rtThumb','Thumbnail URL',s.rating_thumbnail_url)}${field('rtImage','Large image URL',s.rating_image_url)}</article></div>`;
    el.querySelector('[data-ticket-pane="internal"]').innerHTML=`<div class="ticket-grid"><article class="ticket-card"><small>TICKET MESSAGE</small><h4>Inside created tickets</h4>${field('itTitle','Embed title',s.ticket_panel_title,'Supports {category} and {case_id}')}${field('itDesc','Embed description',s.ticket_panel_description,'Supports {user} {reason} {category} {case_id}',true)}${field('itFooter','Footer',s.ticket_panel_footer)}</article></div>`;
    clean();
  }

  function body(){
    return {settings:{category_id:v('tcCategory'),log_channel_id:v('tcLog'),staff_role_id:v('tcStaff'),rating_channel_id:v('tcRating'),verification_rating_channel_id:v('tcVerifyRating'),embed_color:v('tcColor')||'#FFD84D',rating_title:v('rtTitle'),rating_description:v('rtDesc'),rating_footer:v('rtFooter'),rating_thumbnail_url:v('rtThumb'),rating_image_url:v('rtImage'),ticket_panel_title:v('itTitle'),ticket_panel_description:v('itDesc'),ticket_panel_footer:v('itFooter'),category_overrides:configState?.settings?.category_overrides||{}},panels:{support:{title:v('spTitle'),description:v('spDesc'),button_label:v('spButton'),image_url:v('spImage'),questions:q('sp'),button_options:configState?.panels?.support?.button_options||[]},verify:{title:v('vpTitle'),description:v('vpDesc'),button_label:v('vpButton'),image_url:v('vpImage'),questions:q('vp'),button_options:configState?.panels?.verify?.button_options||[]}}};
  }

  async function save(){
    const btn=document.getElementById('ticketSave');if(!btn)return;
    btn.disabled=true;btn.textContent='Saving…';
    try{const d=await configRequest('PATCH',body());renderBuilder(d);const s=document.getElementById('ticketSaveState');if(s)s.textContent='SAVED';setTimeout(clean,1200)}catch(e){const s=document.getElementById('ticketSaveState');if(s){s.textContent='SAVE FAILED';s.classList.add('dirty')}console.error(e);alert(e.message||'Could not save ticket settings')}finally{btn.disabled=false;btn.textContent='Save ticket system'}
  }

  async function refresh(force=false){
    const view=document.getElementById('view-tickets');if(!view?.classList.contains('active'))return;
    const id=guildId();
    if(!force&&loadedGuild===id)return;
    loadedGuild=id;
    loading();
    try{
      const preview=await previewRequest();
      renderStats(preview);
      if(preview.premium){
        try{renderBuilder(await configRequest())}catch(e){hideBuilder();const h=host();if(h)h.insertAdjacentHTML('beforeend',`<div class="finish-banner"><div><span class="finish-kicker">ADMIN REFRESH REQUIRED</span><h3>Refresh Discord to edit premium settings</h3><p>${esc(e.message)}</p></div></div>`)}
      }
    }catch(e){const h=host();if(h)h.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">TICKET NETWORK</span><h3>Ticket data could not load</h3><p>${esc(e.message||'Try refreshing the dashboard')}</p></div></div>`;hideBuilder();}
  }

  document.addEventListener('click',e=>{
    if(e.target?.closest?.('[data-view="tickets"]'))setTimeout(()=>refresh(true),100);
    if(e.target?.closest?.('[data-guild-id],.server-option')){loadedGuild='';configState=null;setTimeout(()=>refresh(true),260)}
  },true);
  const obs=new MutationObserver(()=>{if(document.getElementById('view-tickets')?.classList.contains('active'))setTimeout(()=>refresh(),80)});
  obs.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});
  setTimeout(()=>refresh(true),650);
})();