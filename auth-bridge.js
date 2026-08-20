import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './dashboard-config.js';

const params = new URLSearchParams(window.location.search);
const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const isOAuthReturn =
  params.has('code') ||
  params.has('error') ||
  params.has('error_description') ||
  hash.has('access_token') ||
  hash.has('refresh_token');

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

  const finish = async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      console.error('Bound OAuth callback failed:', error);
      sessionStorage.setItem('bound_auth_error', error.message || 'Discord sign-in failed.');
      window.location.replace(`${window.location.origin}/dashboard.html`);
      return;
    }

    const session = data?.session;
    if (session?.provider_token) {
      sessionStorage.setItem('bound_discord_provider_token', session.provider_token);
    }

    if (session?.access_token) {
      window.location.replace(`${window.location.origin}/dashboard.html`);
      return;
    }

    // Supabase can finish exchanging the OAuth code a moment after page load.
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      const { data: retry } = await supabase.auth.getSession();
      const next = retry?.session;

      if (next?.provider_token) {
        sessionStorage.setItem('bound_discord_provider_token', next.provider_token);
      }

      if (next?.access_token || attempts >= 20) {
        window.clearInterval(timer);
        if (!next?.access_token) {
          sessionStorage.setItem('bound_auth_error', 'Discord returned successfully, but the Supabase session was not created.');
        }
        window.location.replace(`${window.location.origin}/dashboard.html`);
      }
    }, 150);
  };

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.provider_token) {
      sessionStorage.setItem('bound_discord_provider_token', session.provider_token);
    }
    if (session?.access_token) {
      window.location.replace(`${window.location.origin}/dashboard.html`);
    }
  });

  void finish();
}
