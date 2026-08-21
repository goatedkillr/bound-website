import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './dashboard-config.js';

const params = new URLSearchParams(window.location.search);
const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const code = params.get('code');
const oauthError = params.get('error_description') || params.get('error');
const hashAccessToken = hash.get('access_token');
const hashRefreshToken = hash.get('refresh_token');
const hashProviderToken = hash.get('provider_token');
const hashProviderRefreshToken = hash.get('provider_refresh_token');
const isOAuthReturn = Boolean(code || oauthError || hashAccessToken || hashRefreshToken);

if (isOAuthReturn) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  const dashboardUrl = `${window.location.origin}/dashboard.html`;
  const goDashboard = () => window.location.replace(dashboardUrl);
  const markFreshAdminAuth = () => localStorage.setItem('bound_discord_admin_verified_at', String(Date.now()));

  const clearSensitiveUrl = () => {
    try { window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search && !code ? window.location.search : ''}`); } catch {}
  };

  const storeProviderTokens = (session) => {
    const providerToken = session?.provider_token || hashProviderToken;
    const providerRefreshToken = session?.provider_refresh_token || hashProviderRefreshToken;
    if (providerToken) {
      sessionStorage.setItem('bound_discord_provider_token', providerToken);
      localStorage.setItem('bound_discord_provider_token_backup', providerToken);
      markFreshAdminAuth();
    }
    if (providerRefreshToken) localStorage.setItem('bound_discord_provider_refresh_token', providerRefreshToken);
  };

  const fail = (message) => {
    sessionStorage.setItem('bound_auth_error', message || 'Discord sign-in failed.');
    clearSensitiveUrl();
    goDashboard();
  };

  const finish = async () => {
    try {
      if (oauthError) return fail(oauthError);
      if (hashAccessToken && hashRefreshToken) {
        storeProviderTokens(null);
        clearSensitiveUrl();
        const { data, error } = await supabase.auth.setSession({ access_token: hashAccessToken, refresh_token: hashRefreshToken });
        if (error) throw error;
        storeProviderTokens(data?.session);
        if (!data?.session?.access_token) throw new Error('Supabase did not persist the returned Discord session.');
        goDashboard();
        return;
      }
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        storeProviderTokens(data?.session);
        clearSensitiveUrl();
        if (!data?.session?.access_token) throw new Error('Supabase did not create a session from the OAuth code.');
        goDashboard();
        return;
      }
      fail('Discord returned successfully, but Bound could not find the session tokens.');
    } catch (error) {
      console.error('Bound OAuth callback failed:', error);
      fail(error?.message || 'Discord sign-in failed while creating the Supabase session.');
    }
  };

  void finish();
}
