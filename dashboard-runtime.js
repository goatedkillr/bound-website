(() => {
  const originalFetch = window.fetch.bind(window);
  const API_RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
  let inFlight = 0;
  let lastFailure = 0;

  function ensureStatus() {
    if (document.getElementById('connectionStatus')) return;
    const host = document.querySelector('.topbar-actions');
    if (!host) return;
    const pill = document.createElement('button');
    pill.id = 'connectionStatus';
    pill.className = 'status-pill connection-pill';
    pill.type = 'button';
    pill.innerHTML = '<i></i><span>Connected</span>';
    pill.title = 'Dashboard connection status';
    host.prepend(pill);
  }

  function setStatus(state, text) {
    ensureStatus();
    const pill = document.getElementById('connectionStatus');
    if (!pill) return;
    pill.dataset.state = state;
    const label = pill.querySelector('span');
    if (label) label.textContent = text;
  }

  function updateNetwork() {
    if (!navigator.onLine) setStatus('offline', 'Offline');
    else if (inFlight > 0) setStatus('syncing', 'Syncing');
    else if (Date.now() - lastFailure < 10_000) setStatus('recovering', 'Reconnecting');
    else setStatus('online', 'Connected');
  }

  async function resilientApiFetch(input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';
    const sameOriginApi = url.startsWith('/api/') || url.startsWith(`${location.origin}/api/`);
    if (!sameOriginApi) return originalFetch(input, init);

    const method = String(init.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
    const retryable = method === 'GET';
    const attempts = retryable ? 3 : 1;
    let lastError;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!navigator.onLine) {
        lastError = new TypeError('You appear to be offline.');
        lastFailure = Date.now();
        updateNetwork();
        if (!retryable) throw lastError;
        await new Promise(resolve => setTimeout(resolve, 450));
        continue;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14_000);
      inFlight += 1;
      updateNetwork();
      try {
        const response = await originalFetch(input, { ...init, signal: controller.signal });
        if (response.ok || !retryable || !API_RETRY_STATUS.has(response.status) || attempt === attempts - 1) {
          if (!response.ok) lastFailure = Date.now();
          return response;
        }
        lastFailure = Date.now();
        await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1) + Math.random() * 250));
      } catch (error) {
        lastError = error;
        lastFailure = Date.now();
        if (!retryable || attempt === attempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1) + Math.random() * 300));
      } finally {
        clearTimeout(timer);
        inFlight = Math.max(0, inFlight - 1);
        updateNetwork();
      }
    }
    throw lastError || new Error('Dashboard request failed.');
  }

  window.fetch = resilientApiFetch;
  window.addEventListener('online', () => { lastFailure = 0; updateNetwork(); });
  window.addEventListener('offline', updateNetwork);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateNetwork(); });
  window.addEventListener('unhandledrejection', event => {
    const message = String(event.reason?.message || event.reason || '');
    if (/network|fetch|offline|timeout|abort/i.test(message)) { lastFailure = Date.now(); updateNetwork(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { ensureStatus(); updateNetwork(); });
  else { ensureStatus(); updateNetwork(); }
})();