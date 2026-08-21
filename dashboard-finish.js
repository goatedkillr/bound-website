(() => {
  const supportUrl='https://discord.gg/NVseqMDNRd';
  const openDiscord=(copy='Open Bound Society')=>`<div class="finish-actions"><a class="finish-btn primary" href="${supportUrl}" target="_blank" rel="noopener noreferrer">${copy} ↗</a></div>`;
  const pages={
    servers:{
      kicker:'BOUND NETWORK',title:'Your servers in one place.',copy:'Switch between communities you manage see whether Bound is installed and check what each server has unlocked.',pills:['Discord verified','Permission checked','Faction aware'],
      body:`<div class="finish-grid"><article class="finish-card"><span class="finish-state">LIVE</span><div class="finish-icon">◇</div><small>SERVER ACCESS</small><h3>Safe server switching</h3><p>Only servers Discord says you own or can manage appear in your dashboard picker.</p></article><article class="finish-card"><span class="finish-state">SYNCED</span><div class="finish-icon">B</div><small>BOUND STATUS</small><h3>Installation detection</h3><p>Bound checks the server before showing controls so the page always matches what is actually available.</p></article><article class="finish-card"><span class="finish-state locked">OWNER</span><div class="finish-icon">₦</div><small>FACTION ACCESS</small><h3>Approval protected</h3><p>Faction features stay locked until that server has been approved for the Bound faction network.</p></article></div><div class="finish-banner"><div><span class="finish-kicker">SERVER PICKER</span><h3>Use the server selector in the sidebar</h3><p>Every dashboard module follows the server you selected so there is no need to enter IDs again.</p></div></div>`
    },
    moderation:{
      kicker:'BOUND PROFILE',title:'Your Bound progression.',copy:'BDSM XP achievements gag milestones and relationship progress stay connected to your Bound identity.',pills:['BDSM XP','Achievements','Gag milestones','Bond progress'],
      body:`<div class="finish-banner"><div><span class="finish-kicker">PROFILE SYNC</span><h3>Progress follows your Discord identity</h3><p>Your live profile view loads from the same Bound data used by the bot.</p></div></div>`
    },
    tickets:{
      kicker:'SUPPORT OPERATIONS',title:'Tickets built like a real helpdesk.',copy:'Premium private builds unlock live ticket controls custom panels ratings verification and staff workflows.',pills:['Claims','Transcripts','Ratings','Verification','Custom panels'],
      body:`<div id="ticketPremiumSurface"><div class="finish-banner"><div><span class="finish-kicker">CHECKING ACCESS</span><h3>Loading ticket access</h3><p>Bound is checking whether this server has a premium private build.</p></div></div></div>`
    },
    staff:{
      kicker:'BOUND SAFETY',title:'The people protecting Bound.',copy:'This page is dedicated to the active Bound Safety Team and the people handling protected reviews across the network.',pills:['Safety Team','Protected reviews','Real people','Bound wide'],
      body:`<div class="finish-grid"><article class="finish-card wide" id="safetyTeamPanel"><span class="finish-state">LIVE</span><div class="finish-icon">◆</div><small>BOUND SAFETY TEAM</small><h3>Loading the active Safety Team</h3><p>The people responsible for protected Bound safety reviews will appear here.</p></article></div><div class="finish-security"><i></i> Bound Safety is separate from private server staff teams</div>`
    },
    logs:{
      kicker:'AUDIT AND ACTIVITY',title:'Know what changed and why.',copy:'The dashboard keeps activity easy to read while moderation factions safety and staff keep their own deeper records.',pills:['Server scoped','Reasons','Actor tracking','Protected data'],
      body:`<div class="finish-table"><div class="finish-row header"><span>Activity</span><span>Source</span><span>Access</span><span>Status</span></div><div class="finish-row"><b>Moderation cases</b><span>Bound moderation</span><span>Manage Server</span><span>Tracked</span></div><div class="finish-row"><b>Safety review</b><span>Safety system</span><span>Protected</span><span>Tracked</span></div><div class="finish-row"><b>Faction activity</b><span>Faction and Nugs</span><span>Approved server</span><span>Synced</span></div></div>`
    }
  };

  const esc=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const initial=(value='B')=>String(value||'B').trim().charAt(0).toUpperCase()||'B';
  const selectedGuild=()=>localStorage.getItem('bound_dashboard_guild')||'';
  const providerToken=()=>sessionStorage.getItem('bound_discord_provider_token')||localStorage.getItem('bound_discord_provider_token_backup')||'';

  function render(key){
    const def=pages[key],el=document.getElementById(`view-${key}`);
    if(!def||!el||el.dataset.finished==='1')return;
    el.innerHTML=`<div class="finish-shell"><section class="finish-hero"><span class="finish-kicker">${def.kicker}</span><h2>${def.title}</h2><p>${def.copy}</p><div class="finish-pills">${def.pills.map(x=>`<span>${x}</span>`).join('')}</div></section>${def.body}</div>`;
    el.dataset.finished='1';
  }

  function statCard(label,value,copy){return `<article class="finish-card"><small>${label}</small><h3>${value}</h3><p>${copy}</p></article>`;}

  async function getSession(){
    const {supabase}=await import('./supabase-client.js');
    return (await supabase.auth.getSession()).data.session;
  }

  async function loadTicketSurface(){
    render('tickets');
    const surface=document.getElementById('ticketPremiumSurface');
    const guildId=selectedGuild();
    if(!surface||!guildId)return;
    surface.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">CHECKING ACCESS</span><h3>Loading ticket access</h3><p>Checking this server against Bound premium.</p></div></div>`;
    try{
      const session=await getSession();
      if(!session?.access_token)throw new Error('Sign in to view ticket access');
      const headers={Authorization:`Bearer ${session.access_token}`};
      const provider=providerToken();if(provider)headers['X-Discord-Provider-Token']=provider;
      const response=await fetch(`/api/ticket-preview?guild_id=${encodeURIComponent(guildId)}`,{headers});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'Could not load ticket access');
      const stats=data.stats||{};
      if(data.premium){
        surface.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">PREMIUM ACTIVE</span><h3>${esc(data.guild?.name||'This server')} has full ticket control</h3><p>Live private ticket stats and the premium builder below belong only to the selected server.</p></div><span class="finish-state">PREMIUM</span></div><div class="finish-grid">${statCard('TOTAL TICKETS',Number(stats.total||0).toLocaleString('en-GB'),'Tickets created in this private build')}${statCard('OPEN NOW',Number(stats.open||0).toLocaleString('en-GB'),'Currently active tickets')}${statCard('CLAIMED',Number(stats.claimed||0).toLocaleString('en-GB'),'Open tickets currently owned by staff')}${statCard('AVERAGE RATING',stats.average_rating?`${stats.average_rating} / 5`:'No ratings yet',`${Number(stats.rated||0).toLocaleString('en-GB')} completed ratings`)}</div><div class="finish-security"><i></i> Premium controls are server scoped and permission checked</div>`;
      }else{
        surface.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">PRIVATE BUILD PREVIEW</span><h3>See what a live Bound ticket system can become</h3><p>Your selected server does not have premium ticket controls yet so these are aggregate stats from The Dark Side private build.</p></div><span class="finish-state locked">PREVIEW</span></div><div class="finish-grid">${statCard('THE DARK SIDE TICKETS',Number(stats.total||0).toLocaleString('en-GB'),'Real tickets handled through the private build')}${statCard('OPEN NOW',Number(stats.open||0).toLocaleString('en-GB'),'Live aggregate ticket count')}${statCard('CLAIMED',Number(stats.claimed||0).toLocaleString('en-GB'),'Open tickets currently being handled')}${statCard('AVERAGE RATING',stats.average_rating?`${stats.average_rating} / 5`:'Building history',`${Number(stats.rated||0).toLocaleString('en-GB')} completed ratings`)}</div><div class="finish-grid"><article class="finish-card wide"><span class="finish-state">PREMIUM</span><div class="finish-icon">▱</div><small>YOUR OWN TICKET HQ</small><h3>Support ID verification and cross verification in one system</h3><p>Premium servers can edit panel copy questions internal ticket messages rating experiences channels roles and verification flows directly from the dashboard.</p>${openDiscord('Ask about a private build')}</article><article class="finish-card"><span class="finish-state">LIVE CONTROL</span><div class="finish-icon">★</div><small>STAFF FEEDBACK</small><h3>Ratings tied to the last claimer</h3><p>Support ID and cross verification ratings stay separate and can include written feedback.</p></article></div>`;
      }
    }catch(error){
      surface.innerHTML=`<div class="finish-banner"><div><span class="finish-kicker">TICKET ACCESS</span><h3>Refresh Discord to check this server</h3><p>${esc(error?.message||'Ticket access is temporarily unavailable')}</p></div></div>`;
    }
  }

  function renderPersonalContext(data){
    const team=Array.isArray(data?.safety_team)?data.safety_team:[];
    const safetyPanel=document.getElementById('safetyTeamPanel');
    if(safetyPanel){
      safetyPanel.innerHTML=`<span class="finish-state">${team.length} ACTIVE</span><div class="finish-icon">◆</div><small>BOUND SAFETY TEAM</small><h3>Protected reviews handled by real people</h3><p>These are the active Bound wide Safety Team members.</p><div class="finish-list">${team.length?team.map(member=>`<div><i style="overflow:hidden">${member.avatar_url?`<img src="${esc(member.avatar_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`:initial(member.display_name)}</i><span><b>${esc(member.display_name)}${member.is_you?' • You':''}</b><span>${esc(member.role||'Safety Team')}</span></span><em>${member.is_you?'YOU':'ACTIVE'}</em></div>`).join(''):`<div><i>◆</i><span><b>Team list unavailable</b><span>Safety coverage remains active while the directory refreshes.</span></span><em>LIVE</em></div>`}</div>`;
    }

    const factionView=document.getElementById('view-economy');
    if(factionView){
      let card=document.getElementById('userFactionCard');
      if(!card){card=document.createElement('article');card.id='userFactionCard';card.className='panel';card.style.marginBottom='12px';const heading=factionView.querySelector('.section-heading');if(heading)heading.insertAdjacentElement('afterend',card);else factionView.prepend(card)}
      const faction=data?.faction;
      if(faction){
        card.innerHTML=`<div class="panel-title"><div><small>YOUR BOUND FACTION</small><h3>${esc(faction.faction_name||'Faction')}</h3></div><span class="all-good">${esc(String(faction.faction_role||'member').toUpperCase())}</span></div><div class="finish-pills" style="margin:12px 0 4px"><span>Level ${Number(faction.faction_level||1)}</span><span>${Number(faction.power||0).toLocaleString('en-GB')} power</span><span>${Number(faction.money||0).toLocaleString('en-GB')} Nugs</span></div>`;
      }else{
        const browse=Array.isArray(data?.factions_browse)?data.factions_browse:[];
        const rows=browse.length?browse.map(f=>`<div class="faction-browse-row"><span class="mini-avatar">${initial(f.faction_name)}</span><div class="faction-browse-name"><b>${esc(f.faction_name||'Faction')}</b><small>Level ${Number(f.faction_level||1)} • ${Number(f.member_count||0)} members</small></div><div class="faction-browse-stats"><span>${Number(f.power||0).toLocaleString('en-GB')} power</span><span>${Number(f.money||0).toLocaleString('en-GB')} Nugs</span></div></div>`).join(''):'';
        card.innerHTML=`<div class="panel-title"><div><small>YOU ARE NOT IN A FACTION YET</small><h3>Find your faction</h3></div><span class="finish-state locked">OPEN</span></div><p style="color:#8d838f;font-size:10px;line-height:1.7;margin:0 0 12px">Use <b>/faction apply</b> in Discord or open a ticket in Bound Society if you want a new faction created for your community.</p>${rows?`<div class="faction-browse-list">${rows}</div>`:''}${openDiscord('Open Bound Society')}`;
      }
    }
  }

  async function loadPersonalContext(){
    try{
      const session=await getSession();if(!session?.access_token)return;
      const response=await fetch('/api/personal-context',{headers:{Authorization:`Bearer ${session.access_token}`}});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Could not load personal dashboard data');renderPersonalContext(data);
    }catch(error){console.warn('Bound personal dashboard context unavailable:',error?.message||error)}
  }

  function arm(){
    Object.keys(pages).forEach(k=>render(k));
    document.querySelectorAll('.nav-item[data-view]').forEach(btn=>btn.addEventListener('click',()=>{const k=btn.dataset.view;if(pages[k])render(k);if(k==='tickets')setTimeout(loadTicketSurface,40)}));
    document.addEventListener('click',event=>{if(event.target?.closest?.('[data-guild-id]'))setTimeout(loadTicketSurface,250)},true);
    const serverName=document.getElementById('serverName');if(serverName)new MutationObserver(()=>setTimeout(loadTicketSurface,80)).observe(serverName,{childList:true,subtree:true,characterData:true});
    const overview=document.getElementById('view-overview');
    if(overview&&!document.getElementById('finishTrustStrip'))overview.insertAdjacentHTML('beforeend',`<div class="finish-banner" id="finishTrustStrip" style="margin-top:12px"><div><span class="finish-kicker">BUILT TO STAY CONNECTED</span><h3>Discord identity Supabase data and Bound permissions</h3><p>The control centre keeps personal access persistent while protected server changes require current Discord permission.</p></div><div class="finish-security"><i></i> Connection protected</div></div>`);
    loadPersonalContext();
    loadTicketSurface();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm);else arm();
})();
