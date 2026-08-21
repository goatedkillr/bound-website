import { createHash, randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REQUEST_TIMEOUT_MS = 12_000;
const SNOWFLAKE = /^\d{17,20}$/;
const rateBuckets = new Map();

function securityHeaders(res, requestId) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Request-Id', requestId);
}
function send(res, status, body, requestId) { securityHeaders(res, requestId); return res.status(status).json(body); }
function bearer(req) { const v = String(req.headers.authorization || ''); return v.startsWith('Bearer ') ? v.slice(7) : null; }
function tokenKey(token) { return createHash('sha256').update(String(token || '')).digest('hex').slice(0, 24); }
function rateLimit(key, limit = 45, windowMs = 60_000) {
  const now = Date.now();
  const row = rateBuckets.get(key);
  if (!row || row.reset <= now) { rateBuckets.set(key, { count: 1, reset: now + windowMs }); return; }
  row.count += 1;
  if (row.count > limit) { const e = new Error('Too many requests.'); e.status = 429; throw e; }
}
async function fetchTimed(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
async function verifyUser(token) {
  if (!token) return null;
  const r = await fetchTimed(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : null;
}
function discordUserId(user) {
  return String(user?.user_metadata?.provider_id || user?.user_metadata?.sub || user?.identities?.[0]?.identity_data?.sub || user?.id || '');
}
async function rest(path) {
  if (!SERVICE_KEY) { const e = new Error('Dashboard database connection is not configured.'); e.status = 500; throw e; }
  const r = await fetchTimed(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
  const text = await r.text();
  let data = [];
  if (text) { try { data = JSON.parse(text); } catch { data = []; } }
  if (!r.ok) { const e = new Error(data?.message || 'Database request failed.'); e.status = r.status >= 500 ? 502 : r.status; throw e; }
  return data;
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.', request_id: requestId }, requestId);
    const token = bearer(req);
    const user = await verifyUser(token);
    if (!user) return send(res, 401, { error: 'Sign in with Discord first.', request_id: requestId }, requestId);
    const uid = discordUserId(user);
    if (!SNOWFLAKE.test(uid)) return send(res, 401, { error: 'Discord identity could not be verified.', request_id: requestId }, requestId);
    rateLimit(tokenKey(token));

    const [safetyRows, membershipRows, userCache] = await Promise.all([
      rest('safety_team?select=user_id,role,active,added_at&active=eq.true&order=added_at.asc'),
      rest(`faction_members?select=user_id,faction_id,faction_role,joined_at&user_id=eq.${uid}&limit=5`),
      rest('bdsm_discord_user_cache?select=user_id,display_name,avatar_url'),
    ]);

    const cache = new Map((userCache || []).map(row => [String(row.user_id), row]));
    const safetyTeam = (safetyRows || []).map(row => ({
      user_id: String(row.user_id),
      role: String(row.role || 'Safety Team'),
      display_name: cache.get(String(row.user_id))?.display_name || String(row.user_id),
      avatar_url: cache.get(String(row.user_id))?.avatar_url || null,
      is_you: String(row.user_id) === uid,
    }));

    const membership = membershipRows?.[0] || null;
    let faction = null;
    let factionsBrowse = null;
    if (membership?.faction_id) {
      const rows = await rest(`factions?select=faction_id,faction_name,faction_level,faction_xp,power,money,home_guild_id&faction_id=eq.${encodeURIComponent(String(membership.faction_id))}&limit=1`);
      if (rows?.[0]) faction = { ...rows[0], faction_role: membership.faction_role || 'member', joined_at: membership.joined_at || null };
    } else {
      // Not in a faction - give the dashboard enough to render a browse list
      // instead of just "apply in Discord": every faction's public stats,
      // plus a member count tallied from faction_members (small tables, safe
      // to pull in full rather than needing a dedicated count RPC).
      const [allFactions, allMembers] = await Promise.all([
        rest('factions?select=faction_id,faction_name,faction_level,power,money,home_guild_id&order=power.desc'),
        rest('faction_members?select=faction_id'),
      ]);
      const counts = new Map();
      for (const row of allMembers || []) {
        const key = String(row.faction_id);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      factionsBrowse = (allFactions || []).map(f => ({
        faction_id: f.faction_id,
        faction_name: f.faction_name,
        faction_level: f.faction_level,
        power: f.power,
        money: f.money,
        member_count: counts.get(String(f.faction_id)) || 0,
      }));
    }

    return send(res, 200, {
      user: {
        id: uid,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || 'Discord user',
        safety_role: safetyTeam.find(row => row.user_id === uid)?.role || null,
      },
      safety_team: safetyTeam,
      faction,
      factions_browse: factionsBrowse,
      request_id: requestId,
    }, requestId);
  } catch (error) {
    console.error('personal-context', requestId, error?.message || error);
    return send(res, Number(error?.status || 500), { error: error?.message || 'Dashboard request failed.', request_id: requestId }, requestId);
  }
}
