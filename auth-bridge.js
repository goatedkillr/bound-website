import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './dashboard-config.js';

const params = new URLSearchParams(window.location.search);
const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const code = params.get('code');
const oauthError = params.get('error_description') || params.get('error');
const isOAuthReturn = Boolean(
  code || oauthError || hash.get('access_token') || hash.get('refresh_token')
);

if (isOAuthReturn) {
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );

  const goDashboard = () => {
    const target = `${window.location.origin}/dashboard.html`;
    if (window.location.href !== target) window.location.replace(target);
  };

  const storeSession = (session) => {
    if (!session) return false;
    if (session.provider_token) {
      sessionStorage.setItem('bound_discord_provider_token', session.provider_token);
      localStorage.setItem('bound_discord_provider_token_backup', session.provider_token);
    }
    if (session.provider_refresh_token) {
      localStorage.setItem('bound_discord_provider_refresh_token', session.provider_refresh_token);
    }
    return Boolean(session.access_token);
  };

  supabase.auth.onAuthStateChange((_event, session) => {
    if (storeSession(session)) goDashboard();
  });

  const finish = async () => {
    try {
      if (oauthError) {
        sessionStorage.setItem('bound_auth_error', oauthError);
        goDashboard();
        return;
      }

      // PKCE callbacks return ?code=. Explicitly exchange it instead of
      // assuming getSession() will do the exchange for us.
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (storeSession(data?.session)) {
          goDashboard();
          return;
        }
      }

      // Implicit OAuth callbacks return tokens in the URL hash. The browser
      // client processes those automatically, then getSession() exposes them.
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (storeSession(data?.session)) {
        goDashboard();
        return;
      }

      // Allow a short window for Supabase's URL parser/auth event to finish.
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const { data: retry, error: retryError } = await supabase.auth.getSession();
        if (retryError) throw retryError;
        if (storeSession(retry?.session)) {
          goDashboard();
          return;
        }
      }

      sessionStorage.setItem(
        'bound_auth_error',
        'Discord approved the login, but no Supabase session was created. Check the Supabase Site URL and Redirect URLs for this exact website domain.'
      );
      goDashboard();
    } catch (error) {
      console.error('Bound OAuth callback failed:', error);
      sessionStorage.setItem(
        'bound_auth_error',
        error?.message || 'Discord sign-in failed while creating the Supabase session.'
      );
      goDashboard();
    }
  };

  void finish();
}
