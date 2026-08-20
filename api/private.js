import { randomUUID } from 'node:crypto';

const PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const PUBLIC_SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const PRIVATE_SUPABASE_URL = process.env.PRIVATE_SUPABASE_URL || 'https://hobmczasripcpemntobi.supabase.co';
const PRIVATE_SERVICE_KEY = process.env.PRIVATE_SUPABASE_SERVICE_ROLE_KEY;
const SNOWFLAKE = /^\d{17,20}$/;
const TIMEOUT_MS = 12_000;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function send(res, status, body, id) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Request-Id', id);
  return res.status(status).json(body);
}
function bearer(req) { const v = String(req.headers.authorization || ''); return v.startsWith('Bearer ') ? v.slice(7) : null; }
async function fetchTimed(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
async function verifyUser(token) {
  if (!token) return null;
  const r = await fetchTimed(`${PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers: { apikey: PUBLIC_SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : null;
}
function discordUserId(u) { return String(u?.user_metadata?.provider_id || u?.user_metadata?.sub || u?.identities?.[0]?.identity_data?.sub || u?.id || ''); }
function canManageGuild(g) { if (g.owner) return true; const p = BigInt(g.permissions || '0'); return Boolean((p & 0x8n) || (p & 0x20n)); }
async function authorisedGuild(providerToken, guildId) {
  if (!providerToken) throw new HttpError(401, 'Discord connection expired. Reconnect Discord.');
  const r = await fetchTimed('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: `Bearer ${providerToken}` } });
  if (r.status === 401 || r.status === 403) throw new HttpError(401, 'Discord connection expired. Reconnect Discord.');
  if (!r.ok) throw new HttpError(502, 'Discord could not verify this server right now.');
  const guilds = await r.json();
  const guild = guilds.find(g => g.id === guildId && canManageGuild(g));
  if (!guild) throw new HttpError(403, 'You do not have Manage Server permission for this Discord server.');
  return guild;
}
async function privateRest(path) {
  if (!PRIVATE_SERVICE_KEY) throw new HttpError(503, 'Private dashboard connection is not configured yet.');
  const r = await fetchTimed(`${PRIVATE_SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: PRIVATE_SERVICE_KEY, Authorization: `Bearer ${PRIVATE_SERVICE_KEY}` } });
  const text = await r.text(); let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!r.ok) throw new HttpError(r.status >= 500 ? 502 : r.status, 'Private dashboard database request failed.');
  return data;
}
async function safe(fn, fallback) { try { return await fn(); } catch (e) { console.error('private dashboard optional query:', e?.message || e); return fallback; } }
function sum(rows, key) { return rows.reduce((n, row) => n + Number(row?.[key] || 0), 0); }

export default async function handler(req, res) {
  const requestId = randomUUID();
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed.', request_id: requestId }, requestId);
    const guildId = String(req.query.guild_id || '');
    if (!SNOWFLAKE.test(guildId)) throw new HttpError(400, 'Invalid Discord server ID.');
    const user = await verifyUser(bearer(req));
    if (!user || !SNOWFLAKE.test(discordUserId(user))) throw new HttpError(401, 'Sign in with Discord first.');
    const guild = await authorisedGuild(String(req.headers['x-discord-provider-token'] || ''), guildId);

    if (!PRIVATE_SERVICE_KEY) {
      return send(res, 200, { guild: { id: guild.id, name: guild.name }, private_build: null, configured: false, request_id: requestId }, requestId);
    }

    const registry = await safe(() => privateRest(`bound_private_dashboard_servers?select=guild_id,display_name,enabled,brand,premium,modules&guild_id=eq.${guildId}&enabled=eq.true&limit=1`), []);
    const build = registry?.[0] || null;
    if (!build) return send(res, 200, { guild: { id: guild.id, name: guild.name }, private_build: null, configured: true, request_id: requestId }, requestId);

    const modules = build.modules || {};
    const [tickets, staffShifts, staffMembers, economy, subscriptions, moderation] = await Promise.all([
      modules.tickets ? safe(() => privateRest(`tds_tickets?select=id,status,claimed_by,rating,opened_at&guild_id=eq.${guildId}`), []) : [],
      modules.staff ? safe(() => privateRest(`tds_staff_shifts?select=id,status,clocked_in_at,clocked_out_at&guild_id=eq.${guildId}`), []) : [],
      modules.staff ? safe(() => privateRest(`tds_staff_members?select=user_id&guild_id=eq.${guildId}`), []) : [],
      modules.economy ? safe(() => privateRest(`tds_economy_accounts?select=user_id,wallet,bank,total&guild_id=eq.${guildId}`), []) : [],
      modules.subscriptions ? safe(() => privateRest(`tds_subscriptions?select=user_id,tier,active,custom_role_id,extra_role_id&guild_id=eq.${guildId}`), []) : [],
      modules.moderation ? safe(() => privateRest(`tds_moderation_cases?select=id,case_type,created_at&guild_id=eq.${guildId}&case_type=in.(warn,warning,mute,unmute,kick,ban,jail,release,unjail)`), []) : [],
    ]);

    const openTickets = tickets.filter(t => t.status === 'open');
    const ratings = tickets.map(t => Number(t.rating || 0)).filter(Boolean);
    const activeStaff = staffShifts.filter(s => !s.clocked_out_at && s.status !== 'closed');
    const activeSubscriptions = subscriptions.filter(s => s.active !== false);
    const tierCounts = activeSubscriptions.reduce((acc, s) => { acc[s.tier || 'unknown'] = (acc[s.tier || 'unknown'] || 0) + 1; return acc; }, {});

    return send(res, 200, {
      guild: { id: guild.id, name: guild.name },
      private_build: {
        guild_id: build.guild_id,
        display_name: build.display_name,
        brand: build.brand,
        premium: Boolean(build.premium),
        modules,
        stats: {
          tickets: { total: tickets.length, open: openTickets.length, claimed: openTickets.filter(t => t.claimed_by).length, average_rating: ratings.length ? Number((ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1)) : null },
          staff: { members: staffMembers.length, active_shifts: activeStaff.length },
          economy: { users: economy.length, total_nugs: sum(economy, 'total') || sum(economy, 'wallet') + sum(economy, 'bank') },
          subscriptions: { active: activeSubscriptions.length, tiers: tierCounts },
          moderation: { cases: moderation.length },
        },
      },
      configured: true,
      request_id: requestId,
    }, requestId);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(`[private-dashboard ${requestId}]`, e?.message || e);
    return send(res, status, { error: e instanceof Error ? e.message : 'Unexpected private dashboard error.', request_id: requestId }, requestId);
  }
}
