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

// Dashboard is auth-first on every device. If a user opens dashboard.html with
// no Supabase session, send them straight to Discord instead of leaving them on
// a "not signed in" screen. A short-lived guard prevents redirect loops when a
// user cancels OAuth or the provider returns an error.
if (/\/dashboard\.html$/i.test(window.location.pathname)) {
  void (async () => {
    try {
      // Dynamic import (not a static one) deliberately - this module exports
      // the SUPABASE_URL/KEY constants that supabase-client.js itself needs,
      // so a static import here would be a circular import. Dynamic import
      // resolves it at runtime, once this module's own exports already exist.
      const { supabase: authClient } = await import('./supabase-client.js');

      const { data: { session } } = await authClient.auth.getSession();
      if (session?.access_token) {
        sessionStorage.removeItem('bound_auto_auth_started_at');
        return;
      }

      const now = Date.now();
      const lastAttempt = Number(sessionStorage.getItem('bound_auto_auth_started_at') || 0);
      const cooldownMs = 15000;

      if (lastAttempt && now - lastAttempt < cooldownMs) {
        return;
      }

      sessionStorage.setItem('bound_auto_auth_started_at', String(now));

      const { error } = await authClient.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          scopes: 'identify guilds',
          redirectTo: `${window.location.origin}/dashboard.html`,
        },
      });

      if (error) {
        sessionStorage.removeItem('bound_auto_auth_started_at');
        console.error('Bound automatic Discord login failed:', error);
      }
    } catch (error) {
      sessionStorage.removeItem('bound_auto_auth_started_at');
      console.error('Bound automatic Discord login failed:', error);
    }
  })();
}
