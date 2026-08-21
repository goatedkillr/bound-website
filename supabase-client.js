// Single shared Supabase client + Discord provider-token helpers.
//
// Every page used to create its own `createClient()` (dashboard.js,
// admin-auth-guard.js, account-ui.js, dashboard-finish.js, showcase.js,
// welcome-auth.js, auth-bridge.js) even though they all point at the same
// project and the same localStorage session key. Supabase warns about this
// ("Multiple GoTrueClient instances detected") for a real reason: each
// instance runs its own background auto-refresh timer, and two instances
// racing to refresh the same session can cause one of them to end up with a
// stale in-memory "signed out" state even though a perfectly valid session is
// sitting in localStorage - which is exactly the kind of thing that makes a
// dashboard randomly ask you to sign in again. Importing this module instead
// of calling createClient() directly gives every page exactly one auth
// client and one source of truth for tokens.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './dashboard-config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // OAuth is completed once by authReady below. Letting every importing
    // script auto-detect the same one-time PKCE code creates a startup race.
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: window.localStorage,
    storageKey: 'bound-auth-session',
  },
});

const callbackParams = new URLSearchParams(window.location.search);
const callbackHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
export const isAuthCallback = Boolean(
  callbackParams.get('code') || callbackParams.get('error') ||
  callbackParams.get('error_description') || callbackHash.get('access_token')
);

const TOKEN_KEY = 'bound_discord_provider_token';
const TOKEN_BACKUP_KEY = 'bound_discord_provider_token_backup';
const REFRESH_KEY = 'bound_discord_provider_refresh_token';
const ISSUED_KEY = 'bound_discord_provider_token_issued_at';
const VERIFIED_KEY = 'bound_discord_admin_verified_at';

function safeGet(store, key) { try { return store.getItem(key) || ''; } catch { return ''; } }
function safeSet(store, key, value) { try { store.setItem(key, value); } catch { /* storage unavailable */ } }
function safeRemove(store, key) { try { store.removeItem(key); } catch { /* storage unavailable */ } }

/** The Discord access token used for the `X-Discord-Provider-Token` header, wherever it was last stashed. */
export function getStoredProviderToken() {
  return safeGet(sessionStorage, TOKEN_KEY) || safeGet(localStorage, TOKEN_BACKUP_KEY);
}

export function getStoredRefreshToken() {
  return safeGet(localStorage, REFRESH_KEY);
}

/** Milliseconds since the current provider token was captured/refreshed. Infinity if we never captured one. */
export function providerTokenAgeMs() {
  const stamp = Number(safeGet(localStorage, ISSUED_KEY) || 0);
  return stamp ? Date.now() - stamp : Infinity;
}

/** Persists Discord's access + refresh token together, and stamps "now" so freshness checks have something to compare against. */
export function storeProviderTokens({ provider_token, provider_refresh_token } = {}) {
  if (provider_token) {
    safeSet(sessionStorage, TOKEN_KEY, provider_token);
    safeSet(localStorage, TOKEN_BACKUP_KEY, provider_token);
    safeSet(localStorage, ISSUED_KEY, String(Date.now()));
    safeSet(localStorage, VERIFIED_KEY, String(Date.now()));
  }
  if (provider_refresh_token) safeSet(localStorage, REFRESH_KEY, provider_refresh_token);
}

export function clearProviderTokens() {
  safeRemove(sessionStorage, TOKEN_KEY);
  safeRemove(localStorage, TOKEN_BACKUP_KEY);
  safeRemove(localStorage, REFRESH_KEY);
  safeRemove(localStorage, ISSUED_KEY);
  safeRemove(localStorage, VERIFIED_KEY);
}

function clearAuthCallbackUrl() {
  if (!isAuthCallback) return;
  try { window.history.replaceState({}, document.title, window.location.pathname); } catch { /* ignored */ }
}

// The only auth startup path used by the site. Consumers await this promise
// instead of independently reading the session while an OAuth code is still
// being exchanged.
export const authReady = (async () => {
  const oauthError = callbackParams.get('error_description') || callbackParams.get('error');
  if (oauthError) {
    clearAuthCallbackUrl();
    throw new Error(oauthError);
  }

  let session = null;
  const code = callbackParams.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    clearAuthCallbackUrl();
    if (error) throw error;
    session = data.session;
  } else if (callbackHash.get('access_token') && callbackHash.get('refresh_token')) {
    const { data, error } = await supabase.auth.setSession({
      access_token: callbackHash.get('access_token'),
      refresh_token: callbackHash.get('refresh_token'),
    });
    clearAuthCallbackUrl();
    if (error) throw error;
    session = data.session;
  } else {
    session = (await supabase.auth.getSession()).data.session;
  }

  if (session?.provider_token) {
    storeProviderTokens({
      provider_token: session.provider_token,
      provider_refresh_token: session.provider_refresh_token,
    });
  }
  return session || null;
})();

let refreshInFlight = null;

/**
 * Silently exchanges the stored Discord refresh token for a new access token
 * via /api/discord-refresh, so a stale provider token never has to mean
 * sending the user through Discord's consent screen again. Only fails when
 * there truly is no usable refresh token (never captured one yet) or Discord
 * has actually revoked it - at which point the caller should fall back to a
 * real signInWithOAuth() redirect.
 */
export async function refreshProviderToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return null;
      const r = await fetch('/api/discord-refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!r.ok) {
        if (r.status === 401) clearProviderTokens();
        return null;
      }
      const d = await r.json().catch(() => null);
      if (!d?.access_token) return null;
      storeProviderTokens({ provider_token: d.access_token, provider_refresh_token: d.refresh_token || refreshToken });
      return d.access_token;
    } catch (error) {
      console.error('Bound Discord token refresh failed:', error);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/**
 * Returns a Discord provider token that should still work, refreshing
 * silently first if the cached one looks stale. `maxAgeMs` is a local cache
 * window only - real authorisation is always re-checked against Discord's
 * API server-side on every dashboard request, so this can be generous
 * without weakening anything.
 */
export async function ensureFreshProviderToken({ maxAgeMs = 6 * 60 * 60 * 1000 } = {}) {
  const cached = getStoredProviderToken();
  if (cached && providerTokenAgeMs() < maxAgeMs) return cached;
  const refreshed = await refreshProviderToken();
  if (refreshed) return refreshed;
  return cached || null;
}

// Keep the stored provider token/refresh token in sync with whatever the
// single shared client observes, from any tab that triggers a sign-in or
// token refresh.
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.provider_token) {
    storeProviderTokens({ provider_token: session.provider_token, provider_refresh_token: session.provider_refresh_token });
  }
  if (event === 'SIGNED_OUT') clearProviderTokens();
});

