export const SUPABASE_URL = 'https://hpbqoochibnrxzxeuazb.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
export const BOUND_INSTALL_URL = 'https://discord.com/oauth2/authorize?client_id=1537633630384300113';
export const SUPPORT_URL = 'https://discord.gg/NVseqMDNRd';

// OAuth can briefly land on the homepage before dashboard.html. Preserve the
// Discord provider token across that hop so dashboard.js can bootstrap normally.
try {
  const backup = localStorage.getItem('bound_discord_provider_token_backup');
  if (backup && !sessionStorage.getItem('bound_discord_provider_token')) {
    sessionStorage.setItem('bound_discord_provider_token', backup);
  }
} catch {
  // Storage can be unavailable in hardened/private browser modes; auth will
  // fall back to the normal Supabase session flow in that case.
}

// Load the premium Bound Profile + Social/RP showcase layer independently of
// the core dashboard. If this layer fails, the rest of the dashboard still works.
try {
  if (!document.querySelector('link[data-bound-showcase]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './showcase.css';
    link.dataset.boundShowcase = '1';
    document.head.appendChild(link);
  }
  import('./showcase.js').catch(error => console.error('Bound showcase failed:', error));
} catch (error) {
  console.error('Bound showcase loader failed:', error);
}

// Returning users are restored by Supabase from the durable browser session.
// New or explicitly signed-out users stay on the polished Continue screen;
// OAuth only starts after a deliberate click, avoiding redirect loops.

