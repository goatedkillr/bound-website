// Discord OAuth handshake (login/callback), session refresh and logout -
// replaces Supabase Auth as the site's Discord identity broker entirely.
// This file used to be discord-refresh.js (the refresh action only); login/
// callback/logout were added when Supabase Auth was removed so the whole
// Discord OAuth lifecycle has one owner, same as before.
import { randomUUID } from 'node:crypto';
import {
  beginOAuthState, consumeOAuthState, clearOAuthStateCookies,
  issueSessionToken, sessionCookies, logoutCookies, requireSession,
} from '../server/auth.js';

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REQUEST_TIMEOUT_MS = 12_000;
const rateBuckets = new Map();

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function securityHeaders(res, requestId) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Request-Id', requestId);
}
function send(res, status, body, requestId) { securityHeaders(res, requestId); return res.status(status).json(body); }
function setCookies(res, cookies) { res.setHeader('Set-Cookie', cookies); }
function rateLimit(key, limit, windowMs = 60_000) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.reset <= now) { rateBuckets.set(key, { count: 1, reset: now + windowMs }); return; }
  current.count += 1;
  if (current.count > limit) throw new HttpError(429, 'Too many Discord requests. Please wait a moment and try again.');
}
async function fetchTimed(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error?.name === 'AbortError') throw new HttpError(504, 'Discord took too long to respond. Please retry.');
    throw error;
  } finally { clearTimeout(timer); }
}
function siteOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  return `${proto}://${req.headers.host}`;
}
function callbackUrl(req) {
  return `${siteOrigin(req)}/api/discord-oauth?action=callback`;
}
function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

async function handleLogin(req, res) {
  if (!DISCORD_CLIENT_ID) throw new HttpError(500, 'Vercel is missing DISCORD_CLIENT_ID.');
  const returnTo = String(req.query.return_to || '');
  const { state, cookies } = beginOAuthState({ returnTo });
  setCookies(res, cookies);
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    response_type: 'code',
    scope: 'identify guilds',
    state,
  });
  redirect(res, `https://discord.com/oauth2/authorize?${params}`);
}

async function handleCallback(req, res) {
  const failWith = (message) => redirect(res, `${siteOrigin(req)}/dashboard.html#auth_error=${encodeURIComponent(message)}`);
  const oauthError = req.query.error_description || req.query.error;
  if (oauthError) { setCookies(res, clearOAuthStateCookies()); return failWith(String(oauthError)); }

  let returnTo = '';
  try {
    ({ returnTo } = consumeOAuthState(req, String(req.query.state || '')));
  } catch (error) {
    setCookies(res, clearOAuthStateCookies());
    return failWith(error?.message || 'Discord sign-in failed.');
  }

  const code = String(req.query.code || '');
  if (!code || !DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    setCookies(res, clearOAuthStateCookies());
    return failWith('Discord did not return a valid sign-in code.');
  }

  try {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(req),
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
    });
    const tokenResponse = await fetchTimed('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!tokenResponse.ok) throw new HttpError(502, 'Discord could not complete sign-in. Please retry.');
    const tokenData = await tokenResponse.json();

    const identityResponse = await fetchTimed('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!identityResponse.ok) throw new HttpError(502, 'Discord could not confirm your identity. Please retry.');
    const identity = await identityResponse.json();

    const session = issueSessionToken({ discordUserId: identity.id, name: identity.global_name || identity.username, avatar: identity.avatar });
    setCookies(res, [...sessionCookies(session), ...clearOAuthStateCookies()]);

    const fragment = new URLSearchParams({
      discord_provider_token: tokenData.access_token,
      discord_provider_refresh_token: tokenData.refresh_token,
      discord_provider_expires_in: String(tokenData.expires_in || ''),
    });
    if (returnTo) fragment.set('view', returnTo);
    redirect(res, `${siteOrigin(req)}/dashboard.html#${fragment.toString()}`);
  } catch (error) {
    setCookies(res, clearOAuthStateCookies());
    console.error('[discord-oauth callback]', error?.message || error);
    failWith(error?.message || 'Discord sign-in failed. Please retry.');
  }
}

async function handleRefresh(req, res, requestId) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.', request_id: requestId }, requestId);
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return send(res, 500, { error: 'Vercel is missing DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET.', request_id: requestId }, requestId);
  }
  const session = requireSession(req);
  rateLimit(`discord-refresh:${session.discordUserId}`, 20);

  const refreshToken = String(req.body?.refresh_token || '').trim();
  if (!refreshToken || refreshToken.length > 512) {
    return send(res, 400, { error: 'A Discord refresh token is required.', request_id: requestId }, requestId);
  }
  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
  });
  const r = await fetchTimed('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  if (r.status === 400 || r.status === 401) {
    return send(res, 401, { error: 'Discord refresh token is no longer valid. Reconnect Discord.', request_id: requestId }, requestId);
  }
  if (!r.ok) return send(res, 502, { error: 'Discord could not refresh this session right now. Please retry.', request_id: requestId }, requestId);
  const data = await r.json();
  return send(res, 200, { access_token: data.access_token, refresh_token: data.refresh_token, expires_in: data.expires_in, request_id: requestId }, requestId);
}

function handleLogout(req, res, requestId) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.', request_id: requestId }, requestId);
  setCookies(res, logoutCookies());
  return send(res, 200, { ok: true, request_id: requestId }, requestId);
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  try {
    securityHeaders(res, requestId);
    const action = String(req.query.action || '');
    if (action === 'login') return await handleLogin(req, res);
    if (action === 'callback') return await handleCallback(req, res);
    if (action === 'refresh') return await handleRefresh(req, res, requestId);
    if (action === 'logout') return handleLogout(req, res, requestId);
    return send(res, 404, { error: 'Unknown Discord OAuth action.', request_id: requestId }, requestId);
  } catch (e) {
    const status = e?.status && Number.isInteger(e.status) ? e.status : 500;
    console.error(`[discord-oauth ${requestId}]`, e?.message || e);
    return send(res, status, { error: e instanceof Error ? e.message : 'Unexpected error during Discord sign-in.', request_id: requestId }, requestId);
  }
}
