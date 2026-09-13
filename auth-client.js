// Discord OAuth + session client helpers, replacing Supabase Auth (GoTrue).
//
// api/discord-oauth.js now owns the whole Discord OAuth handshake server-side
// and issues its own signed, HttpOnly session cookie - the browser never
// handles an auth token of its own any more, so there is no client SDK here.
// This module's job shrinks to three things: read the one-time hash payload
// the OAuth callback redirect leaves on dashboard.html, keep Discord's own
// access/refresh token (the "provider token", used separately for live guild
// permission checks) in storage exactly as before, and offer thin
// login/logout wrappers.
const TOKEN_KEY = 'bound_discord_provider_token';
const TOKEN_BACKUP_KEY = 'bound_discord_provider_token_backup';
const REFRESH_KEY = 'bound_discord_provider_refresh_token';
const ISSUED_KEY = 'bound_discord_provider_token_issued_at';
const VERIFIED_KEY = 'bound_discord_admin_verified_at';
const SIGNED_IN_COOKIE = 'bound_signed_in';

function safeGet(store, key) { try { return store.getItem(key) || ''; } catch { return ''; } }
function safeSet(store, key, value) { try { store.setItem(key, value); } catch { /* storage unavailable */ } }
function safeRemove(store, key) { try { store.removeItem(key); } catch { /* storage unavailable */ } }

/** The Discord access token used for the `X-Discord-Provider-Token` header, wherever it was last stashed. */
export function getStoredProviderToken() {
  return safeGet(sessionStorage, TOKEN_KEY) || safeGet(localStorage, TOKEN_BACKUP_KEY);
}

function getStoredRefreshToken() {
  return safeGet(localStorage, REFRESH_KEY);
}

/** Milliseconds since the current provider token was captured/refreshed. Infinity if we never captured one. */
function providerTokenAgeMs() {
  const stamp = Number(safeGet(localStorage, ISSUED_KEY) || 0);
  return stamp ? Date.now() - stamp : Infinity;
}

/** Persists Discord's access + refresh token together, and stamps "now" so freshness checks have something to compare against. */
function storeProviderTokens({ provider_token, provider_refresh_token } = {}) {
  if (provider_token) {
    safeSet(sessionStorage, TOKEN_KEY, provider_token);
    safeSet(localStorage, TOKEN_BACKUP_KEY, provider_token);
    safeSet(localStorage, ISSUED_KEY, String(Date.now()));
    safeSet(localStorage, VERIFIED_KEY, String(Date.now()));
  }
  if (provider_refresh_token) safeSet(localStorage, REFRESH_KEY, provider_refresh_token);
}

function clearProviderTokens() {
  safeRemove(sessionStorage, TOKEN_KEY);
  safeRemove(localStorage, TOKEN_BACKUP_KEY);
  safeRemove(localStorage, REFRESH_KEY);
  safeRemove(localStorage, ISSUED_KEY);
  safeRemove(localStorage, VERIFIED_KEY);
}

function hasSignedInHint() {
  return document.cookie.split('; ').some(part => part.startsWith(`${SIGNED_IN_COOKIE}=`));
}

/** Redirects the browser into the Discord OAuth flow. `returnTo` ('' or 'account') survives the round trip via authCallbackView. */
export function startDiscordLogin(returnTo = '') {
  const query = returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : '';
  location.href = `/api/discord-oauth?action=login${query}`;
}

export async function signOut() {
  try { await fetch('/api/discord-oauth?action=logout', { method: 'POST' }); } catch { /* best-effort */ }
  clearProviderTokens();
}

const callbackHash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
export const isAuthCallback = Boolean(callbackHash.get('discord_provider_token') || callbackHash.get('auth_error'));
/** 'account' when the OAuth flow was started to land back on the account tab, else ''. Read this instead of location.hash - the hash is cleared below before most other scripts run. */
export const authCallbackView = callbackHash.get('view') || '';

function clearAuthCallbackUrl() {
  if (!isAuthCallback) return;
  try { window.history.replaceState({}, document.title, window.location.pathname); } catch { /* ignored */ }
}

// The only auth startup path used by the site. Consumers await this before
// treating the page as signed in/out, so a just-completed Discord redirect's
// provider token is captured before anything else runs. Resolves to whether
// the browser currently holds a Bound session cookie (never throws for
// "signed out" - only for a genuine Discord error the callback reported).
export const authReady = (async () => {
  const authError = callbackHash.get('auth_error');
  if (authError) {
    clearAuthCallbackUrl();
    throw new Error(authError);
  }
  const providerToken = callbackHash.get('discord_provider_token');
  if (providerToken) {
    storeProviderTokens({
      provider_token: providerToken,
      provider_refresh_token: callbackHash.get('discord_provider_refresh_token') || '',
    });
    clearAuthCallbackUrl();
  }
  return hasSignedInHint();
})();

let refreshInFlight = null;

/**
 * Silently exchanges the stored Discord refresh token for a new access token
 * via /api/discord-oauth, so a stale provider token never has to mean
 * sending the user through Discord's consent screen again. Only fails when
 * there truly is no usable refresh token (never captured one yet) or Discord
 * has actually revoked it - at which point the caller should fall back to a
 * real startDiscordLogin() redirect.
 */
export async function refreshProviderToken() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const refreshToken = getStoredRefreshToken();
      if (!refreshToken) return null;
      const r = await fetch('/api/discord-oauth?action=refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
