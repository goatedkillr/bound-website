// Self-issued Discord session, replacing Supabase Auth (GoTrue).
//
// A session is a signed, opaque token carried in an HttpOnly cookie: HMAC(
// SESSION_SECRET, base64url(JSON claims) ), the two parts joined with ".".
// Verifying it is a local signature check (node:crypto only, no dependency,
// no network call) - the same shape as a JWT, hand-rolled because the only
// thing this site ever needed from Supabase's GoTrue was "who is this",
// and every API route already re-checks real authorisation (Discord guild
// permissions) server-side on every request regardless of what the session
// says. See server/database.js for the equivalent hand-rolled-shim precedent
// for Supabase's data layer.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export class SessionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const SESSION_COOKIE = 'bound_session';
export const SIGNED_IN_COOKIE = 'bound_signed_in';
const STATE_COOKIE = 'bound_oauth_state';
const RETURN_TO_COOKIE = 'bound_oauth_return_to';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const OAUTH_FLOW_TTL_SECONDS = 600;
const SNOWFLAKE = /^\d{17,20}$/;
const RETURN_TO_VALUES = new Set(['', 'account']);

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new SessionError(503, 'Session signing is not configured.');
  return value;
}

function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issueSessionToken({ discordUserId, name, avatar }) {
  if (!SNOWFLAKE.test(String(discordUserId || ''))) throw new SessionError(500, 'Cannot issue a session without a Discord user id.');
  const now = Math.floor(Date.now() / 1000);
  const claims = { v: 1, sub: discordUserId, name: name || null, avatar: avatar || null, iat: now, exp: now + SESSION_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  let expected;
  try { expected = sign(payload); } catch { return null; }
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return null;
  let claims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return null; }
  if (claims?.v !== 1 || !SNOWFLAKE.test(String(claims.sub || '')) || typeof claims.exp !== 'number') return null;
  if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return { discordUserId: String(claims.sub), name: claims.name || null, avatar: claims.avatar || null, issuedAt: claims.iat, expiresAt: claims.exp };
}

export function parseCookies(req) {
  const header = req.headers?.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const part of String(header).split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    const raw = part.slice(eq + 1).trim();
    try { cookies[key] = decodeURIComponent(raw); } catch { cookies[key] = raw; }
  }
  return cookies;
}

export function getSession(req) {
  return verifySessionToken(parseCookies(req)[SESSION_COOKIE]);
}

export function requireSession(req) {
  const session = getSession(req);
  if (!session) throw new SessionError(401, 'Sign in with Discord first.');
  return session;
}

function cookieAttributes({ maxAgeSeconds, httpOnly }) {
  const parts = ['Path=/', 'SameSite=Lax', 'Secure'];
  if (httpOnly) parts.push('HttpOnly');
  parts.push(`Max-Age=${Math.max(0, maxAgeSeconds)}`);
  return parts.join('; ');
}

export function sessionCookies(token) {
  return [
    `${SESSION_COOKIE}=${token}; ${cookieAttributes({ maxAgeSeconds: SESSION_TTL_SECONDS, httpOnly: true })}`,
    `${SIGNED_IN_COOKIE}=1; ${cookieAttributes({ maxAgeSeconds: SESSION_TTL_SECONDS, httpOnly: false })}`,
  ];
}

export function logoutCookies() {
  return [
    `${SESSION_COOKIE}=; ${cookieAttributes({ maxAgeSeconds: 0, httpOnly: true })}`,
    `${SIGNED_IN_COOKIE}=; ${cookieAttributes({ maxAgeSeconds: 0, httpOnly: false })}`,
  ];
}

// ---- OAuth CSRF state (login -> Discord -> callback round trip only) ----

export function beginOAuthState({ returnTo = '' } = {}) {
  const safeReturnTo = RETURN_TO_VALUES.has(returnTo) ? returnTo : '';
  const state = randomUUID();
  const cookies = [
    `${STATE_COOKIE}=${state}; ${cookieAttributes({ maxAgeSeconds: OAUTH_FLOW_TTL_SECONDS, httpOnly: true })}`,
    `${RETURN_TO_COOKIE}=${safeReturnTo}; ${cookieAttributes({ maxAgeSeconds: OAUTH_FLOW_TTL_SECONDS, httpOnly: true })}`,
  ];
  return { state, returnTo: safeReturnTo, cookies };
}

export function consumeOAuthState(req, incomingState) {
  const cookies = parseCookies(req);
  const expected = cookies[STATE_COOKIE];
  const returnTo = RETURN_TO_VALUES.has(cookies[RETURN_TO_COOKIE]) ? cookies[RETURN_TO_COOKIE] : '';
  if (!expected || !incomingState || expected !== incomingState) {
    throw new SessionError(400, 'This Discord sign-in link expired or was already used. Please try again.');
  }
  return { returnTo };
}

export function clearOAuthStateCookies() {
  return [
    `${STATE_COOKIE}=; ${cookieAttributes({ maxAgeSeconds: 0, httpOnly: true })}`,
    `${RETURN_TO_COOKIE}=; ${cookieAttributes({ maxAgeSeconds: 0, httpOnly: true })}`,
  ];
}

// Cookies auto-attach same-site, so mutating routes need an explicit origin
// check in place of the old "the client had to know a Bearer token" defence.
export function requireSameOrigin(req) {
  const origin = String(req.headers.origin || req.headers.referer || '');
  if (!origin) return;
  const host = String(req.headers.host || '');
  let originHost;
  try { originHost = new URL(origin).host; } catch { throw new SessionError(403, 'Request origin could not be verified.'); }
  if (originHost !== host) throw new SessionError(403, 'Request origin did not match.');
}
