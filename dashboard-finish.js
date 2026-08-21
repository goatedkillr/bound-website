(() => {
  const supportUrl='https://discord.gg/NVseqMDNRd';
  const openDiscord=(copy='Open Bound Society')=>`<div class="finish-actions"><a class="finish-btn primary" href="${supportUrl}" target="_blank" rel="noopener noreferrer">${copy} ↗</a></div>`;
  const pages={
    servers:{
      kicker:'BOUND NETWORK',title:'Your servers in one place.',copy:'Switch between communities you manage see whether Bound is installed and check what each server has unlocked.',pills:['Discord verified','Permission checked','Faction aware'],
      body:`<div class="finish-grid"><article class="finish-card"><span class="finish-state">LIVE</span><div class="finish-icon">◇</div><small>SERVER ACCESS</small><h3>Safe server switching</h3><p>Only servers Discord says you own or can manage appear in your dashboard picker.</p></article><article class="finish-card"><span class="finish-state">SYNCED</span><div class="finish-icon">B</div><small>BOUND STATUS</small><h3>Installation detection</h3><p>Bound checks the server before showing controls so the page always matches what is actually available.</p></article><article class="finish-card"><span class="finish-state locked">OWNER</span><div class="finish-icon">₦</div><small>FACTION ACCESS</small><h3>Approval protected</h3><p>Faction features stay locked until that server has been approved for the Bound faction network.</p></article></div><div class="finish-banner"><div><span class="finish-kicker">SERVER PICKER</span><h3>Use the server selector in the sidebar</h3><p>Every dashboard module follows the server you selected so there is no need to enter IDs again.</p></div><div class="finish-progress"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div></div>`
    },
    moderation:{
      kicker:'BOUND MODERATION',title:'Everything you need without the clutter.',copy:'The dashboard reflects your moderation setup while sensitive actions stay protected by Discord permissions and backend checks.',pills:['Case history','Custom notices','Jail workflows','Protected actions'],
      body:`<div class="finish-grid"><article class="finish-card wide"><span class="finish-state">DISCORD CONTROL</span><div class="finish-icon">⌁</div><small>MODERATION CENTRE</small><h3>Cases warnings and actions</h3><p>Use Bound in Discord for warnings mutes kicks bans jail and case lookups. The dashboard keeps the setup easy to read and safe to manage.</p><div class="finish-list"><div><i>!</i><span><b>tds caselist @user</b><span>Review that user's moderation history for the server</span></span><em>READY</em></div><div><i>✉</i><span><b>/moderation-panel</b><span>Change the DM wording users receive for moderation actions</span></span><em>LIVE</em></div><div><i>▣</i><span><b>Jail and containment</b><span>Private moderation and isolation tools for your server</span></span><em>LOCKED</em></div></div></article><article class="finish-card"><span class="finish-state">PROTECTED</span><div class="finish-icon">◆</div><small>SAFETY LAYER</small><h3>Every action is checked</h3><p>Server permission is checked again before anything is changed and private keys never reach the browser.</p></article></div><div class="finish-security"><i></i> Every write action is checked before Supabase is touched</div>`
    },
    tickets:{
      kicker:'SUPPORT OPERATIONS',title:'Tickets that feel like a real helpdesk.',copy:'Bound connects ticket creation claims transcripts ratings and staff performance without making your team jump between systems.',pills:['Claims','Transcripts','Ratings','Verification','Terminate'],
      body:`<div class="finish-grid"><article class="finish-card"><span class="finish-state">LIVE</span><div class="finish-icon">▱</div><small>TICKET FLOW</small><h3>Support and verification</h3><p>Multiple ticket panels can use different questions roles and flows while still feeding the same staff system.</p></article><article class="finish-card"><span class="finish-state">TRACKED</span><div class="finish-icon">★</div><small>FEEDBACK</small><h3>Ratings after close</h3><p>Users can rate staff after a ticket closes so performance stats reflect the support they actually received.</p></article><article class="finish-card"><span class="finish-state">MANAGE MESSAGES</span><div class="finish-icon">×</div><small>TERMINATE</small><h3>End a ticket instantly</h3><p>Terminate is separate from normal closing and can be used by members with Manage Messages.</p></article></div><div class="finish-banner"><div><span class="finish-kicker">SAFE CLOSURE</span><h3>Close keeps the record while terminate ends it</h3><p>Normal closure keeps the transcript and rating flow. Terminate skips that process when the ticket needs to end straight away.</p></div><div class="finish-progress"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i></div></div>`
    },
    staff:{
      kicker:'STAFF HQ',title:'The people behind Bound.',copy:'See the active Bound Safety Team alongside the private staff tools available to custom communities.',pills:['Safety Team','Clock in and out','Break approval','Assignments','Weekly stats'],
      body:`<div class="finish-grid"><article class="finish-card wide" id="safetyTeamPanel"><span class="finish-state">LIVE</span><div class="finish-icon">◆</div><small>BOUND SAFETY TEAM</small><h3>Loading the active Safety Team</h3><p>The people responsible for protected Bound safety reviews will appear here.</p></article><article class="finish-card"><span class="finish-state">PRIVATE BUILD</span><div class="finish-icon">♙</div><small>SERVER STAFF OPERATIONS</small><h3>Staff systems built around your server</h3><p>Clocking breaks temporary roles assignments and ticket performance can all live inside a private Bound build.</p>${openDiscord('Ask about custom staff tools')}</article></div><div class="finish-banner"><div><span class="finish-kicker">PRIVATE STAFF HQ</span><h3>Clocking breaks assignments and performance</h3><p>Private builds can give staff one clean place to work while the Bound Safety Team remains a separate protected network.</p></div><div class="finish-progress"><i class="on"></i><i class="on"></i><i class="on"></i><i class="on"></i><i></i></div></div>`
    },
    logs:{
      kicker:'AUDIT AND ACTIVITY',title:'Know what changed and why.',copy:'The dashboard keeps activity easy to read while moderation factions safety and staff keep their own deeper records.',pills:['Server scoped','Reasons','Actor tracking','Protected data'],
      body:`<div class="finish-table"><div class="finish-row header"><span>Activity</span><span>Source</span><span>Access</span><span>Status</span></div><div class="finish-row"><b>Moderation cases</b><span>Bound moderation</span><span>Manage Server</span><span>Tracked</span></div><div class="finish-row"><b>Safety review</b><span>Safety system</span><span>Protected</span><span>Tracked</span></div><div class="finish-row"><b>Faction activity</b><span>Faction / Nugs</span><span>Approved server</span><span>Synced</span></div><div class="finish-row"><b>Staff performance</b><span>Tickets / staff</span><span>Private build</span><span>Tracked</span></div></div><div class="finish-banner"><div><span class="finish-kicker">FULL SEARCH</span><h3>Detailed audit search stays protected</h3><p>The overview shows recent activity now and deeper search can be added as each permission area is connected.</p></div><div class="finish-progress"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></div></div>`
    }
  };

  const esc=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initial=(value='B')=>String(value||'B').trim().charAt(0).toUpperCase()||'B';

  function render(key){
    const def=pages[key],el=document.getElementById(`view-${key}`);
    if(!def||!el||el.dataset.finished==='1')return;
    el.innerHTML=`<div class="finish-shell"><section class="finish-hero"><span class="finish-kicker">${def.kicker}</span><h2>${def.title}</h2><p>${def.copy}</p><div class="finish-pills">${def.pills.map(x=>`<span>${x}</span>`).join('')}</div></section>${def.body}</div>`;
    el.dataset.finished='1';
  }

  function renderPersonalContext(data){
    const team=Array.isArray(data?.safety_team)?data.safety_team:[];
    const safetyPanel=document.getElementById('safetyTeamPanel');
    if(safetyPanel){
      safetyPanel.innerHTML=`<span class="finish-state">${team.length} ACTIVE</span><div class="finish-icon">◆</div><small>BOUND SAFETY TEAM</small><h3>Protected reviews handled by real people</h3><p>The Safety Team is separate from server staff and handles Bound-wide protected review work.</p><div class="finish-list">${team.length?team.map(member=>`<div><i style="overflow:hidden">${member.avatar_url?`<img src="${esc(member.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`:initial(member.display_name)}</i><span><b>${esc(member.display_name)}${member.is_you?' • You':''}</b><span>${esc(member.role||'Safety Team')}</span></span><em>${member.is_you?'YOU':'ACTIVE'}</em></div>`).join(''):`<div><i>◆</i><span><b>No public team entries</b><span>The Safety Team list is currently unavailable.</span></span><em>PRIVATE</em></div>`}</div>`;
    }

    const factionView=document.getElementById('view-economy');
    if(factionView){
      let card=document.getElementById('userFactionCard');
      if(!card){
        card=document.createElement('article');
        card.id='userFactionCard';
        card.className='panel';
        card.style.marginBottom='12px';
        const heading=factionView.querySelector('.section-heading');
        if(heading)heading.insertAdjacentElement('afterend',card);else factionView.prepend(card);
      }
      const faction=data?.faction;
      if(faction){
        card.innerHTML=`<div class="panel-title"><div><small>YOUR BOUND FACTION</small><h3>${esc(faction.faction_name||'Faction')}</h3></div><span class="all-good">${esc(String(faction.faction_role||'member').toUpperCase())}</span></div><div class="finish-pills" style="margin:12px 0 4px"><span>Level ${Number(faction.faction_level||1)}</span><span>${Number(faction.power||0).toLocaleString('en-GB')} power</span><span>${Number(faction.money||0).toLocaleString('en-GB')} Nugs</span></div><p style="color:#8d838f;font-size:10px;line-height:1.65;margin:12px 0 0">You are connected to this faction through Bound. Use Discord for applications member actions and faction commands.</p>`;
      }else{
        card.innerHTML=`<div class="panel-title"><div><small>YOUR BOUND FACTION</small><h3>You are not in a faction yet</h3></div><span class="finish-state locked">OPEN</span></div><p style="color:#8d838f;font-size:10px;line-height:1.7;margin:0">Use <b>/faction apply</b> in Discord to apply to an existing faction. If you want a new faction created for your community open a ticket in Bound Society and the team can review the request.</p>${openDiscord('Open Bound Society')}`;
      }
    }
  }

  async function loadPersonalContext(){
    try{
      const [{createClient},{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY}]=await Promise.all([
        import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm'),
        import('./dashboard-config.js'),
      ]);
      const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      let session=(await client.auth.getSession()).data.session;
      if(!session){await new Promise(resolve=>setTimeout(resolve,900));session=(await client.auth.getSession()).data.session;}
      if(!session?.access_token)return;
      const response=await fetch('/api/personal-context',{headers:{Authorization:`Bearer ${session.access_token}`}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not load personal dashboard data.');
      renderPersonalContext(data);
    }catch(error){console.warn('Bound personal dashboard context unavailable:',error?.message||error);}
  }

  function arm(){
    Object.keys(pages).forEach(k=>render(k));
    document.querySelectorAll('.nav-item[data-view]').forEach(btn=>btn.addEventListener('click',()=>{const k=btn.dataset.view;if(pages[k])render(k)}));
    const overview=document.getElementById('view-overview');
    if(overview&&!document.getElementById('finishTrustStrip')){
      overview.insertAdjacentHTML('beforeend',`<div class="finish-banner" id="finishTrustStrip" style="margin-top:12px"><div><span class="finish-kicker">BUILT TO STAY CONNECTED</span><h3>Discord identity Supabase data and Bound permissions</h3><p>The control centre checks server access keeps safe reads moving through connection issues and protects every write behind permission checks.</p></div><div class="finish-security"><i></i> Connection protected</div></div>`);
    }
    loadPersonalContext();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm);else arm();
})();