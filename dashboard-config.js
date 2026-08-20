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
