// Exchanges a stored Discord OAuth refresh token for a new access token,
// so the browser can keep using Discord-backed dashboard features without
// sending the user through Discord's consent screen again on every visit.
// Mirrors api/dashboard.js's request-handling conventions (security headers,
// rate limiting, timeouts, Supabase-session verification) intentionally.
import { randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
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
function bearer(req) { const v = req.headers.authorization || ''; return v.startsWith('Bearer ') ? v.slice(7) : null; }
function rateLimit(key, limit, windowMs = 60_000) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.reset <= now) { rateBuckets.set(key, { count: 1, reset: now + windowMs }); return; }
  current.count += 1;
  if (current.count > limit) throw new HttpError(429, 'Too many Discord refresh attempts. Please wait a moment and try again.');
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
async function verifyUser(token) {
  if (!token) return null;
  const r = await fetchTimed(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : null;
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  try {
    securityHeaders(res, requestId);
    if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed.', request_id: requestId }, requestId);
    if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
      return send(res, 500, { error: 'Vercel is missing DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET.', request_id: requestId }, requestId);
    }

    const user = await verifyUser(bearer(req));
    if (!user) return send(res, 401, { error: 'Sign in first.', request_id: requestId }, requestId);
    rateLimit(`discord-refresh:${user.id}`, 20);

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
    return send(res, 200, {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      request_id: requestId,
    }, requestId);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(`[discord-refresh ${requestId}]`, e?.message || e);
    return send(res, status, { error: e instanceof Error ? e.message : 'Unexpected error refreshing Discord.', request_id: requestId }, requestId);
  }
}
