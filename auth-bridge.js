import { supabase, storeProviderTokens } from './supabase-client.js';

// Fallback handler for a Discord OAuth return landing on index.html instead
// of dashboard.html (the normal redirectTo target). The shared client
// (supabase-client.js) is created with detectSessionInUrl:true, so it already
// exchanges the `code`/hash tokens in the URL automatically on import - this
// file's job is just to wait for that to land, stash the Discord provider
// token alongside it, and forward on to the dashboard. It deliberately does
// NOT call exchangeCodeForSession/setSession itself: the shared client would
// already be racing to consume the same single-use code, and two consumers
// of one PKCE code is exactly the kind of thing that causes a "sign-in
// failed" for no visible reason.
const params = new URLSearchParams(window.location.search);
const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const code = params.get('code');
const oauthError = params.get('error_description') || params.get('error');
const hashAccessToken = hash.get('access_token');
const hashRefreshToken = hash.get('refresh_token');
const isOAuthReturn = Boolean(code || oauthError || hashAccessToken || hashRefreshToken);

if (isOAuthReturn) {
  const dashboardUrl = `${window.location.origin}/dashboard.html`;
  const goDashboard = () => window.location.replace(dashboardUrl);

  const clearSensitiveUrl = () => {
    try { window.history.replaceState({}, document.title, window.location.pathname); } catch {}
  };

  const fail = (message) => {
    sessionStorage.setItem('bound_auth_error', message || 'Discord sign-in failed.');
    clearSensitiveUrl();
    goDashboard();
  };

  const finish = async () => {
    try {
      if (oauthError) return fail(oauthError);

      // Give the shared client's own detectSessionInUrl a moment to finish
      // exchanging the code/hash, then read whatever it landed.
      let session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        session = await new Promise((resolve) => {
          const timer = setTimeout(() => { sub.subscription.unsubscribe(); resolve(null); }, 8000);
          const sub = supabase.auth.onAuthStateChange((event, s) => {
            if (s?.access_token) { clearTimeout(timer); sub.subscription.unsubscribe(); resolve(s); }
          });
        });
      }

      clearSensitiveUrl();
      if (!session?.access_token) throw new Error('Supabase did not create a session from the Discord OAuth return.');
      storeProviderTokens({ provider_token: session.provider_token, provider_refresh_token: session.provider_refresh_token });
      goDashboard();
    } catch (error) {
      console.error('Bound OAuth callback failed:', error);
      fail(error?.message || 'Discord sign-in failed while creating the Supabase session.');
    }
  };

  void finish();
}
