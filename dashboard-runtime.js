(() => {
  const providerBackup = localStorage.getItem('bound_discord_provider_token_backup');
  if (!sessionStorage.getItem('bound_discord_provider_token') && providerBackup) sessionStorage.setItem('bound_discord_provider_token', providerBackup);

  const originalFetch = window.fetch.bind(window);
  const API_RETRY_STATUS = new Set([408,425,429,500,502,503,504]);
  const responseCache = new Map();
  const pendingGets = new Map();
  const CACHE_MS = 7000;
  let inFlight=0,lastFailure=0;

  const style=document.createElement('style');style.textContent=`.connection-pill{transition:.2s ease;min-width:86px;justify-content:center;gap:7px;cursor:default}.connection-pill i{width:6px;height:6px;border-radius:50%;background:#66d59a;box-shadow:0 0 12px rgba(102,213,154,.8)}.connection-pill[data-state="syncing"]{color:#d7b3ff;border-color:rgba(197,168,255,.18);background:rgba(197,168,255,.07)}.connection-pill[data-state="syncing"] i{background:#c5a8ff;box-shadow:0 0 12px rgba(197,168,255,.8);animation:boundPulse 1s ease-in-out infinite}.connection-pill[data-state="recovering"]{color:#f0c58e;border-color:rgba(240,182,109,.18);background:rgba(240,182,109,.07)}.connection-pill[data-state="offline"]{color:#f49aaa;border-color:rgba(241,113,131,.2);background:rgba(241,113,131,.08)}@keyframes boundPulse{50%{opacity:.35;transform:scale(.72)}}@media(max-width:720px){.connection-pill{min-width:34px;width:34px;padding:0}.connection-pill span{display:none}}`;document.head.appendChild(style);

  function ensureStatus(){if(document.getElementById('connectionStatus'))return;const host=document.querySelector('.topbar-actions');if(!host)return;const pill=document.createElement('button');pill.id='connectionStatus';pill.className='status-pill connection-pill';pill.type='button';pill.innerHTML='<i></i><span>Connected</span>';host.prepend(pill)}
  function setStatus(state,text){ensureStatus();const pill=document.getElementById('connectionStatus');if(!pill)return;pill.dataset.state=state;const label=pill.querySelector('span');if(label)label.textContent=text}
  function updateNetwork(){if(!navigator.onLine)setStatus('offline','Offline');else if(inFlight>0)setStatus('syncing','Syncing');else if(Date.now()-lastFailure<10000)setStatus('recovering','Reconnecting');else setStatus('online','Connected')}

  function requestUrl(input){return typeof input==='string'?input:input?.url||''}
  function cacheKey(input,init){const url=requestUrl(input);const auth=init?.headers?.Authorization||init?.headers?.authorization||'';const discord=init?.headers?.['X-Discord-Provider-Token']||'';return `${url}|${String(auth).slice(-16)}|${String(discord).slice(-12)}`}
  function cloneCached(entry){return new Response(entry.body,{status:entry.status,statusText:entry.statusText,headers:entry.headers})}
  function clearApiCache(){responseCache.clear();pendingGets.clear()}

  async function doApiFetch(input,init={},retryable=true){
    const attempts=retryable?3:1;let lastError;
    for(let attempt=0;attempt<attempts;attempt++){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);inFlight++;updateNetwork();
      try{
        const response=await originalFetch(input,{...init,signal:controller.signal});
        if(response.ok||!retryable||!API_RETRY_STATUS.has(response.status)||attempt===attempts-1){if(!response.ok)lastFailure=Date.now();return response}
        lastFailure=Date.now();await new Promise(r=>setTimeout(r,250*(attempt+1)+Math.random()*150));
      }catch(error){
        lastError=error;lastFailure=Date.now();if(!retryable||attempt===attempts-1)throw error;await new Promise(r=>setTimeout(r,300*(attempt+1)+Math.random()*180));
      }finally{clearTimeout(timer);inFlight=Math.max(0,inFlight-1);updateNetwork()}
    }
    throw lastError||new Error('Dashboard request failed');
  }

  async function resilientApiFetch(input,init={}){
    const url=requestUrl(input);const same=url.startsWith('/api/')||url.startsWith(`${location.origin}/api/`);if(!same)return originalFetch(input,init);
    const method=String(init.method||(typeof input!=='string'?input?.method:'')||'GET').toUpperCase();
    if(method!=='GET'){clearApiCache();return doApiFetch(input,init,false)}
    const key=cacheKey(input,init);const cached=responseCache.get(key);
    if(cached&&Date.now()-cached.at<CACHE_MS)return cloneCached(cached);
    if(pendingGets.has(key))return (await pendingGets.get(key)).clone();
    const task=(async()=>{const response=await doApiFetch(input,init,true);if(response.ok){const body=await response.clone().text();responseCache.set(key,{at:Date.now(),body,status:response.status,statusText:response.statusText,headers:[...response.headers.entries()]})}return response})();
    pendingGets.set(key,task);try{return (await task).clone()}finally{pendingGets.delete(key)}
  }

  window.fetch=resilientApiFetch;
  window.boundClearDashboardCache=clearApiCache;
  window.addEventListener('online',()=>{lastFailure=0;clearApiCache();updateNetwork()});
  window.addEventListener('offline',updateNetwork);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&navigator.onLine){lastFailure=0;updateNetwork()}});

  const arm=()=>{
    document.body.classList.add('dashboard-page');
    ensureStatus();updateNetwork();
    document.getElementById('logoutBtn')?.addEventListener('click',()=>{localStorage.removeItem('bound_discord_provider_token_backup');localStorage.removeItem('bound_discord_provider_refresh_token');localStorage.removeItem('bound_discord_admin_verified_at');localStorage.removeItem('bound_discord_provider_token_issued_at');sessionStorage.removeItem('bound_discord_provider_token');clearApiCache()},{capture:true});
    if(!document.querySelector('link[href="private-controls.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='private-controls.css';document.head.appendChild(l)}
    if(!document.querySelector('script[src="private-controls.js"]')){const s=document.createElement('script');s.src='private-controls.js';s.defer=true;document.body.appendChild(s)}
    if(!document.querySelector('script[src="dashboard-access.js"]')){const s=document.createElement('script');s.src='dashboard-access.js';s.defer=true;document.body.appendChild(s)}
    if(!document.querySelector('script[src="dashboard-polish.js"]')){const s=document.createElement('script');s.src='dashboard-polish.js';s.defer=true;document.body.appendChild(s)}
    if(!document.querySelector('script[src="account-ui.js"]')){const s=document.createElement('script');s.type='module';s.src='account-ui.js';document.body.appendChild(s)}
    if(!document.querySelector('script[src="dashboard-auth-shell.js"]')){const s=document.createElement('script');s.type='module';s.src='dashboard-auth-shell.js';document.body.appendChild(s)}
    if(!document.querySelector('script[src="admin-auth-guard.js"]')){const s=document.createElement('script');s.type='module';s.src='admin-auth-guard.js';document.body.appendChild(s)}
    if(!document.querySelector('link[href="faction-control.css"]')){const l=document.createElement('link');l.rel='stylesheet';l.href='faction-control.css';document.head.appendChild(l)}
    if(!document.querySelector('script[src="faction-control.js"]')){const s=document.createElement('script');s.type='module';s.src='faction-control.js';document.body.appendChild(s)}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arm);else arm();
})();

