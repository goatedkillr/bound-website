import { supabase, authReady, ensureFreshProviderToken } from './supabase-client.js';

const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('en-GB').format(Number(v||0));
let data=null,loading=false;

function guildId(){return localStorage.getItem('bound_dashboard_guild')||''}
async function request(action,{method='GET',body}={}){
  const session=await authReady;
  const provider=await ensureFreshProviderToken();
  if(!session?.access_token||!provider)throw new Error('Your Discord session is not ready.');
  const response=await fetch(`/api/dashboard?action=${encodeURIComponent(action)}`,{method,headers:{Authorization:`Bearer ${session.access_token}`,'X-Discord-Provider-Token':provider,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error||`Faction request failed (${response.status}).`);
  return payload;
}

function ensureShell(){
  const view=$('view-economy');if(!view||$('factionLeaderCentre'))return;
  view.insertAdjacentHTML('beforeend',`<section class="faction-centre" id="factionLeaderCentre" hidden><div class="faction-centre-head"><div><span class="eyebrow">LEADER CONTROL CENTRE</span><h2>Run your faction</h2><p>Members, treasury, upgrades and market holdings—all backed by the live Bound economy.</p></div><button type="button" id="factionRefresh">Refresh</button></div><div id="factionCentreBody"><div class="faction-loading">Loading faction controls…</div></div></section>`);
  $('factionRefresh')?.addEventListener('click',()=>load(true));
}

function memberActions(member,leaderId){
  if(member.user_id===leaderId)return '<span class="faction-role leader">Leader</span>';
  const promote=member.faction_role==='officer'?'demote':'promote';
  return `<div class="faction-row-actions"><button data-member-action="${promote}" data-user="${esc(member.user_id)}">${promote==='promote'?'Make officer':'Make member'}</button><button class="danger" data-member-action="kick" data-user="${esc(member.user_id)}">Remove</button></div>`;
}

function render(){
  const root=$('factionLeaderCentre'),body=$('factionCentreBody');if(!root||!body||!data)return;
  $('view-economy')?.classList.add('global-faction-mode');
  root.hidden=false;
  const f=data.faction||{},items=data.shop?.items||[],companies=data.market?.companies||[],holdings=data.portfolio?.holdings||data.portfolio?.companies||[],apps=data.applications||[];
  body.innerHTML=`
    <div class="faction-stat-grid"><article><small>FACTION TREASURY</small><strong>${fmt(f.money)} ⛓</strong><span>${esc(f.faction_name||'Faction')}</span></article><article><small>YOUR BONDS BALANCE</small><strong>${fmt(data.personal_balance)}</strong><span>Available to deposit</span></article><article><small>MEMBERS</small><strong>${fmt(data.members?.length)}</strong><span>Limit ${fmt(f.maximum_members||20)}</span></article><article><small>APPLICATIONS</small><strong>${f.applications_open?'Open':'Closed'}</strong><button id="factionApplicationsToggle">${f.applications_open?'Close applications':'Open applications'}</button></article></div>
    <div class="faction-control-grid">
      <article class="faction-card"><div class="faction-card-title"><div><small>TREASURY</small><h3>Deposit holdings</h3></div></div><p>Move your Bonds balance into the faction treasury at a 1:1 rate. Deposits cannot be reversed from the dashboard.</p><div class="faction-inline"><input id="factionDepositAmount" type="number" min="1" step="1" placeholder="Amount"><button id="factionDeposit">Deposit</button></div><div class="faction-history">${(data.deposits||[]).map(x=>`<div><span>${esc(x.display_name)}</span><b>+${fmt(x.amount)} ⛓</b></div>`).join('')||'<small>No dashboard deposits yet.</small>'}</div></article>
      <article class="faction-card"><div class="faction-card-title"><div><small>MEMBERS</small><h3>Faction roster</h3></div><div class="faction-inline compact"><input id="factionAddUser" inputmode="numeric" placeholder="Discord user ID"><button id="factionAddMember">Add</button></div></div><div class="faction-member-list">${(data.members||[]).map(m=>`<div class="faction-member"><span class="mini-avatar">${esc((m.display_name||'?')[0])}</span><div><b>${esc(m.display_name)}</b><small>${esc(m.faction_role)} · ${fmt(m.balance)} global</small></div>${memberActions(m,data.leader_user_id)}</div>`).join('')}</div></article>
    </div>
    <article class="faction-card faction-apps"><div class="faction-card-title"><div><small>APPLICATIONS</small><h3>Pending requests</h3></div><span>${apps.length} pending</span></div><div class="faction-app-list">${apps.map(a=>`<div><div><b>${esc(a.display_name)}</b><small>${esc(a.application_message||'No message supplied')}</small></div><div class="faction-row-actions"><button data-application-action="approve" data-application="${a.id}">Approve</button><button class="danger" data-application-action="deny" data-application="${a.id}">Deny</button></div></div>`).join('')||'<div class="faction-empty">No pending applications.</div>'}</div></article>
    <article class="faction-card"><div class="faction-card-title"><div><small>FACTION SHOP</small><h3>Permanent upgrades</h3></div><span>${fmt(data.shop?.faction_balance)} ⛓ available</span></div><div class="faction-shop-grid">${items.map(i=>`<div class="faction-product"><span>${esc(i.emoji||'◆')}</span><div><b>${esc(i.name||i.item_name)}</b><small>${esc(i.description)}</small></div><strong>${fmt(i.price)} ⛓</strong><button data-shop-item="${esc(i.item_id)}" ${i.sold_out?'disabled':''}>${i.sold_out?'Sold out':'Buy upgrade'}</button></div>`).join('')}</div></article>
    <article class="faction-card"><div class="faction-card-title"><div><small>GLOBAL MARKET</small><h3>Faction holdings</h3></div><span>${fmt(data.market?.faction_net_worth)} ⛓ net worth</span></div><div class="faction-market-grid">${companies.map(c=>`<div class="faction-company"><span>${esc(c.emoji||'◆')}</span><div><b>${esc(c.ticker)} · ${esc(c.name||c.company_name)}</b><small>${esc(c.sector)} · ${fmt(c.available_shares)} available</small></div><strong>${fmt(c.current_price)} ⛓</strong><input type="number" min="1" step="1" value="1" data-shares="${esc(c.ticker)}"><div><button data-trade="buy" data-ticker="${esc(c.ticker)}">Buy</button><button data-trade="sell" data-ticker="${esc(c.ticker)}">Sell</button></div></div>`).join('')}</div><div class="faction-holdings"><h4>Current portfolio</h4>${Array.isArray(holdings)&&holdings.length?holdings.map(h=>`<div><b>${esc(h.ticker)}</b><span>${fmt(h.shares_owned||h.shares)} shares</span><strong>${fmt(h.current_value||h.market_value)} ⛓</strong></div>`).join(''):`<p>${esc(data.portfolio?.portfolio_display||'No shares owned yet.')}</p>`}</div></article>`;
  bind();
}

function setBusy(button,busy,label='Working…'){if(!button)return;if(busy){button.dataset.label=button.textContent;button.textContent=label;button.disabled=true}else{button.textContent=button.dataset.label||button.textContent;button.disabled=false}}
async function mutate(button,action,body){try{setBusy(button,true);await request(action,{method:'POST',body});await load(true)}catch(error){alert(error.message)}finally{setBusy(button,false)}}
function bind(){
  $('factionDeposit')?.addEventListener('click',e=>mutate(e.currentTarget,'faction_deposit',{amount:Number($('factionDepositAmount')?.value)}));
  $('factionAddMember')?.addEventListener('click',e=>mutate(e.currentTarget,'faction_member',{member_action:'add',target_user_id:$('factionAddUser')?.value.trim()}));
  $('factionApplicationsToggle')?.addEventListener('click',e=>mutate(e.currentTarget,'faction_setting',{applications_open:!Boolean(data?.faction?.applications_open)}));
  document.querySelectorAll('[data-member-action]').forEach(b=>b.addEventListener('click',()=>mutate(b,'faction_member',{member_action:b.dataset.memberAction,target_user_id:b.dataset.user})));
  document.querySelectorAll('[data-application-action]').forEach(b=>b.addEventListener('click',()=>mutate(b,'faction_application',{review_action:b.dataset.applicationAction,application_id:Number(b.dataset.application)})));
  document.querySelectorAll('[data-shop-item]').forEach(b=>b.addEventListener('click',()=>mutate(b,'faction_shop_buy',{item_id:b.dataset.shopItem})));
  document.querySelectorAll('[data-trade]').forEach(b=>b.addEventListener('click',()=>mutate(b,'faction_market_trade',{trade:b.dataset.trade,ticker:b.dataset.ticker,shares:Number(document.querySelector(`[data-shares="${CSS.escape(b.dataset.ticker)}"]`)?.value)})));
}

async function load(force=false){
  ensureShell();const root=$('factionLeaderCentre'),body=$('factionCentreBody');if(!root||loading||(!force&&data))return;
  loading=true;root.hidden=false;if(body)body.innerHTML='<div class="faction-loading">Syncing the live global faction economy…</div>';
  try{data=await request('faction_center');render()}catch(error){root.hidden=true;$('view-economy')?.classList.remove('global-faction-mode');data=null;console.info('Faction leader controls unavailable:',error.message)}finally{loading=false}
}

window.addEventListener('bound:guild-change',()=>{data=null;if($('view-economy')?.classList.contains('active'))load(true)});
document.addEventListener('click',event=>{if(event.target?.closest?.('[data-view="economy"],[data-jump="economy"]'))setTimeout(()=>load(),0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureShell);else ensureShell();

