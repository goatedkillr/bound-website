import { createHash, randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOUND_OWNER_IDS = new Set(['444659348854013955']);
const SNOWFLAKE = /^\d{17,20}$/;
const REQUEST_TIMEOUT_MS = 12_000;
// A guild's member/permission list rarely changes within a single dashboard
// session, and this cache is only ever consulted for the currently signed-in
// user's own token, so a longer window trades a small amount of staleness
// for far fewer redundant round trips to Discord's API (every guild-scoped
// action calls discordGuilds() to re-check permissions).
const DISCORD_CACHE_MS = 120_000;
const rateBuckets = new Map();
const discordCache = new Map();

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
function tokenKey(token) { return createHash('sha256').update(String(token || '')).digest('hex').slice(0, 24); }
function requestOrigin(req) { return String(req.headers.origin || req.headers.referer || ''); }
function allowedOrigin(req) {
  const origin = requestOrigin(req);
  if (!origin) return true;
  const host = String(req.headers.host || '');
  try { return new URL(origin).host === host; } catch { return false; }
}
function checkBody(req) {
  if (!req.body) return;
  const size = Buffer.byteLength(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  if (size > 32_000) throw new HttpError(413, 'Dashboard request is too large.');
}
function rateLimit(key, limit, windowMs = 60_000) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.reset <= now) { rateBuckets.set(key, { count: 1, reset: now + windowMs }); return; }
  current.count += 1;
  if (current.count > limit) throw new HttpError(429, 'Too many dashboard requests. Please wait a moment and try again.');
}
async function fetchTimed(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  catch (error) {
    if (error?.name === 'AbortError') throw new HttpError(504, 'A connected service took too long to respond. Please retry.');
    throw error;
  } finally { clearTimeout(timer); }
}
async function verifyUser(token) {
  if (!token) return null;
  const r = await fetchTimed(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  return r.ok ? r.json() : null;
}
async function discordGuilds(token) {
  if (!token) throw new HttpError(401, 'Discord connection expired. Sign out and reconnect Discord.');
  const key = tokenKey(token), cached = discordCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  const r = await fetchTimed('https://discord.com/api/v10/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401 || r.status === 403) throw new HttpError(401, 'Discord connection expired. Sign out and reconnect Discord.');
  if (!r.ok) throw new HttpError(502, 'Discord could not return your servers right now. Please retry.');
  const value = await r.json();
  discordCache.set(key, { value, expires: Date.now() + DISCORD_CACHE_MS });
  if (discordCache.size > 250) for (const [k, v] of discordCache) if (v.expires <= Date.now()) discordCache.delete(k);
  return value;
}
function canManageGuild(g) { if (g.owner) return true; const p = BigInt(g.permissions || '0'); return Boolean((p & 0x8n) || (p & 0x20n)); }
function iconUrl(g) { return g?.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.webp?size=128` : null; }
function compactNumber(v) { const n = Number(v || 0); if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`; if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`; return String(n); }
function discordUserId(u) { return String(u?.user_metadata?.provider_id || u?.user_metadata?.sub || u?.identities?.[0]?.identity_data?.sub || u?.id || ''); }
function validateGuildId(id) { if (!SNOWFLAKE.test(id)) throw new HttpError(400, 'Invalid Discord server ID.'); return id; }
function validateSnowflakeOrNull(value, label) { const v = String(value || '').trim(); if (!v) return null; if (!SNOWFLAKE.test(v)) throw new HttpError(400, `${label} must be a valid Discord ID.`); return v; }
async function rest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  if (!SERVICE_KEY) throw new HttpError(500, 'Vercel is missing SUPABASE_SERVICE_ROLE_KEY.');
  const r = await fetchTimed(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text(); let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!r.ok) throw new HttpError(r.status >= 500 ? 502 : r.status, typeof data === 'string' ? 'Database request failed.' : (data?.message || `Database request failed (${r.status})`));
  return data;
}
async function safe(q, f) { try { return await q(); } catch (e) { console.error('Optional dashboard query failed:', e?.message || e); return f; } }
async function authorisedGuild(providerToken, id) {
  const gs = await discordGuilds(providerToken);
  const g = gs.find(x => x.id === id && canManageGuild(x));
  if (!g) throw new HttpError(403, 'You do not have Manage Server permission for this Discord server.');
  return g;
}
async function patchOrInsert(table, guildId, patch, base = {}) {
  const cur = await rest(`${table}?select=guild_id&guild_id=eq.${guildId}`);
  if (cur?.length) return rest(`${table}?guild_id=eq.${guildId}`, { method: 'PATCH', body: { ...patch, updated_at: new Date().toISOString() } });
  return rest(table, { method: 'POST', body: { guild_id: guildId, ...base, ...patch } });
}
async function factionForGuild(guildId) {
  const approvals = await safe(() => rest(`faction_server_approvals?select=*&guild_id=eq.${guildId}&enabled=eq.true`), []);
  if (approvals.length === 1) { const rows = await safe(() => rest(`factions?select=*&faction_id=eq.${approvals[0].faction_id}`), []); if (rows.length === 1) return { status: 'approved', approved: true, faction: rows[0], display_faction: rows[0], approval: approvals[0], matches: 1 }; }
  const candidates = await safe(() => rest(`factions?select=*&home_guild_id=eq.${guildId}&order=created_at.asc`), []);
  // Not yet approved as the guild's canonical faction, but if there is exactly
  // one unambiguous faction linked to this server we can still show its real
  // stats read-only - "Locked" should mean "we don't know", not "we know but
  // won't tell you". Writes (settings toggles etc.) still require `approved`.
  const displayFaction = candidates.length === 1 ? candidates[0] : null;
  return { status: 'awaiting_owner_approval', approved: false, faction: null, display_faction: displayFaction, approval: null, matches: candidates.length, candidates, ambiguous: candidates.length > 1 };
}

async function buildOverview(guild, guildId) {
  const factionState = await factionForGuild(guildId), fid = factionState.display_faction?.faction_id;
  const [settings, activation, verify, safetyGuild, safetyCases, cages, gags, balances, activity, gagConfig, members, upgrades, portfolio, heistStats, userCache] = await Promise.all([
    safe(() => rest(`guild_settings?select=*&guild_id=eq.${guildId}`), []), safe(() => rest(`bound_guild_activation?select=*&guild_id=eq.${guildId}`), []), safe(() => rest(`verify_settings?select=*&guild_id=eq.${guildId}`), []), safe(() => rest(`safety_guilds?select=*&guild_id=eq.${guildId}`), []), safe(() => rest(`safety_cases?select=case_id,case_reference,reported_user_id,requested_flag_type,status,reason,created_at&reporter_guild_id=eq.${guildId}&order=created_at.desc&limit=10`), []), safe(() => rest(`ownership_cages?select=guild_id,sub_id,owner_id,cage_channel_id,created_at&guild_id=eq.${guildId}`), []), safe(() => rest(`bdsm_active_gags?select=gagged_user_id,owner_id,gag_style,expires_at,started_at&guild_id=eq.${guildId}&active=eq.true`), []), safe(() => rest('user_balances?select=user_id,money'), []), safe(() => rest(`game_activity_history?select=user_id,activity_type,money_earned,created_at&guild_id=eq.${guildId}&order=created_at.desc&limit=8`), []), safe(() => rest(`bdsm_safety_config?select=*&guild_id=eq.${guildId}`), []), fid ? safe(() => rest(`faction_members?select=user_id,faction_role,joined_at&faction_id=eq.${fid}`), []) : Promise.resolve([]), fid ? safe(() => rest(`faction_upgrades?select=*&faction_id=eq.${fid}`), []) : Promise.resolve([]), fid ? safe(() => rest(`faction_stock_portfolios?select=*&faction_id=eq.${fid}`), []) : Promise.resolve([]), fid ? safe(() => rest(`faction_heist_statistics?select=*&faction_id=eq.${fid}`), []) : Promise.resolve([]), safe(() => rest('bdsm_discord_user_cache?select=user_id,display_name,avatar_url'), []),
  ]);
  const total = balances.reduce((s, r) => s + Number(r.money || 0), 0), pending = safetyCases.filter(x => ['pending', 'needs_evidence'].includes(x.status)), cm = new Map(userCache.map(x => [x.user_id, x])), bm = new Map(balances.map(x => [x.user_id, Number(x.money || 0)])), memberRows = members.map(m => ({ ...m, display_name: cm.get(m.user_id)?.display_name || m.user_id, avatar_url: cm.get(m.user_id)?.avatar_url || null, balance: bm.get(m.user_id) || 0 })).sort((a, b) => b.balance - a.balance);
  return { guild: { id: guild.id, name: guild.name, icon_url: iconUrl(guild) }, settings: settings[0] || { guild_id: guildId, prefix: '£' }, activation: activation[0] || null, verification: verify[0] || null, safety: { config: safetyGuild[0] || null, cases: safetyCases, pending: pending.length, cages, active_gags: gags, gag_config: gagConfig[0] || { guild_id: guildId, blocked_channel_ids: [], log_channel_id: null } }, faction: { ...factionState, members: memberRows, upgrades, portfolio, heist_stats: heistStats[0] || null }, economy: { total_nugs: total, total_nugs_display: compactNumber(total), users: balances.length }, activity };
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  try {
    securityHeaders(res, requestId);
    if (!['GET', 'PATCH', 'POST'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.', request_id: requestId }, requestId);
    if (!SERVICE_KEY) return send(res, 500, { error: 'Vercel is missing SUPABASE_SERVICE_ROLE_KEY.', request_id: requestId }, requestId);
    checkBody(req);
    if (req.method !== 'GET' && !allowedOrigin(req)) return send(res, 403, { error: 'Dashboard write rejected because the request origin did not match.', request_id: requestId }, requestId);

    const user = await verifyUser(bearer(req));
    if (!user) return send(res, 401, { error: 'Sign in with Discord first.', request_id: requestId }, requestId);
    const uid = discordUserId(user);
    if (!SNOWFLAKE.test(uid)) return send(res, 401, { error: 'Discord identity could not be verified.', request_id: requestId }, requestId);
    const action = String(req.query.action || 'bootstrap');
    const providerToken = String(req.headers['x-discord-provider-token'] || '');
    rateLimit(`${uid}:${req.method === 'GET' ? 'read' : 'write'}`, req.method === 'GET' ? 120 : 30);

    if (action === 'bootstrap' && req.method === 'GET') {
      const guilds = (await discordGuilds(providerToken)).filter(canManageGuild), ids = guilds.map(g => g.id);
      let activation = [], approvals = [];
      if (ids.length) {
        activation = await safe(() => rest(`bound_guild_activation?select=guild_id,tos_accepted&guild_id=in.(${ids.join(',')})`), []);
        approvals = await safe(() => rest(`faction_server_approvals?select=guild_id,faction_id,enabled&guild_id=in.(${ids.join(',')})&enabled=eq.true`), []);
      }
      const am = new Map(activation.map(x => [x.guild_id, x])), fm = new Map(approvals.map(x => [x.guild_id, x]));
      const payload = { user: { id: uid, username: user.user_metadata?.user_name || 'Discord user', display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || 'Discord user', avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null, is_bound_owner: BOUND_OWNER_IDS.has(uid) }, guilds: guilds.map(g => ({ id: g.id, name: g.name, icon_url: iconUrl(g), owner: g.owner, bound_installed: am.has(g.id), tos_accepted: am.get(g.id)?.tos_accepted || false, faction_status: fm.has(g.id) ? 'approved' : 'awaiting_owner_approval' })), request_id: requestId };
      // Fold the initially-selected guild's overview into the bootstrap
      // response when the client already knows which guild it wants (e.g.
      // the last one picked, remembered in localStorage) - saves a whole
      // extra request+serverless round trip on first paint. Best-effort: a
      // failure here just means the client falls back to its own separate
      // overview request, same as before this existed.
      const wantGuildId = String(req.query.guild_id || '');
      if (wantGuildId && SNOWFLAKE.test(wantGuildId)) {
        const targetGuild = guilds.find(g => g.id === wantGuildId);
        if (targetGuild) {
          try { payload.overview = await buildOverview(targetGuild, wantGuildId); }
          catch (e) { console.error('Bootstrap inline overview failed:', e?.message || e); }
        }
      }
      return send(res, 200, payload, requestId);
    }

    const guildId = validateGuildId(String(req.query.guild_id || ''));
    const guild = await authorisedGuild(providerToken, guildId);

    if (action === 'overview' && req.method === 'GET') {
      return send(res, 200, { ...(await buildOverview(guild, guildId)), request_id: requestId }, requestId);
    }

    if (action === 'settings' && req.method === 'PATCH') {
      const prefix = String(req.body?.prefix ?? '').trimEnd();
      if (!prefix || prefix.length > 5 || /[\r\n\u0000-\u001f]/.test(prefix)) return send(res, 400, { error: 'Prefix must be 1–5 visible characters.', request_id: requestId }, requestId);
      const updated = await rest(`guild_settings?guild_id=eq.${guildId}`, { method: 'PATCH', body: { prefix, updated_at: new Date().toISOString() } });
      if (updated?.length) return send(res, 200, { settings: updated[0], request_id: requestId }, requestId);
      const inserted = await rest('guild_settings', { method: 'POST', body: { guild_id: guildId, prefix } });
      return send(res, 200, { settings: inserted?.[0] || { guild_id: guildId, prefix }, request_id: requestId }, requestId);
    }

    if (action === 'toggle' && req.method === 'PATCH') {
      const group = String(req.body?.group || ''), key = String(req.body?.key || ''), value = req.body?.value;
      if (typeof value !== 'boolean') return send(res, 400, { error: 'Toggle value must be true or false.', request_id: requestId }, requestId);
      if (group === 'verify') { const allowed = new Set(['welcome_enabled', 'post_verify_enabled', 'welcome_ping_user', 'safety_staff_setup_enabled']); if (!allowed.has(key)) return send(res, 400, { error: 'Unsupported verification setting.', request_id: requestId }, requestId); const rows = await patchOrInsert('verify_settings', guildId, { [key]: value }, { setup_by: uid }); return send(res, 200, { group, key, value: Boolean(rows?.[0]?.[key] ?? value), request_id: requestId }, requestId); }
      if (group === 'safety') { const allowed = new Set(['safety_enabled', 'auto_ban_minor_safety', 'auto_ban_harassment_tos', 'auto_ban_network_ban', 'auto_unban_on_removal']); if (!allowed.has(key)) return send(res, 400, { error: 'Unsupported safety setting.', request_id: requestId }, requestId); const rows = await patchOrInsert('safety_guilds', guildId, { [key]: value }, { configured_by: uid }); return send(res, 200, { group, key, value: Boolean(rows?.[0]?.[key] ?? value), request_id: requestId }, requestId); }
      if (group === 'faction') { const f = await factionForGuild(guildId); if (!f.approved) return send(res, 403, { error: 'Factions are awaiting Bound owner approval for this server.', request_id: requestId }, requestId); if (key !== 'applications_open') return send(res, 400, { error: 'Unsupported faction setting.', request_id: requestId }, requestId); const rows = await rest(`factions?faction_id=eq.${f.faction.faction_id}`, { method: 'PATCH', body: { applications_open: value, updated_at: new Date().toISOString() } }); return send(res, 200, { group, key, value: Boolean(rows?.[0]?.applications_open ?? value), request_id: requestId }, requestId); }
      return send(res, 400, { error: 'Unsupported setting group.', request_id: requestId }, requestId);
    }

    if (action === 'gag_config' && req.method === 'PATCH') {
      const blockedRaw = Array.isArray(req.body?.blocked_channel_ids) ? req.body.blocked_channel_ids : [];
      if (blockedRaw.length > 50) return send(res, 400, { error: 'Too many blocked gag channels.', request_id: requestId }, requestId);
      const blocked = [...new Set(blockedRaw.map(x => validateSnowflakeOrNull(x, 'Blocked channel')).filter(Boolean))];
      const logChannel = validateSnowflakeOrNull(req.body?.log_channel_id, 'Gag log channel');
      const rows = await patchOrInsert('bdsm_safety_config', guildId, { blocked_channel_ids: blocked, log_channel_id: logChannel }, { configured_by: uid });
      return send(res, 200, { config: rows?.[0] || { guild_id: guildId, blocked_channel_ids: blocked, log_channel_id: logChannel }, request_id: requestId }, requestId);
    }

    if (action === 'faction_approve' && req.method === 'POST') {
      if (!BOUND_OWNER_IDS.has(uid)) return send(res, 403, { error: 'Only the Bound owner can approve server factions.', request_id: requestId }, requestId);
      const factionId = String(req.body?.faction_id || '').trim();
      if (!factionId || factionId.length > 100) return send(res, 400, { error: 'Choose a valid faction to approve.', request_id: requestId }, requestId);
      const rows = await rest(`factions?select=faction_id,faction_name,home_guild_id&faction_id=eq.${encodeURIComponent(factionId)}`);
      if (rows.length !== 1) return send(res, 404, { error: 'Faction not found.', request_id: requestId }, requestId);
      await rest('faction_server_approvals', { method: 'POST', body: { guild_id: guildId, faction_id: factionId, approved_by: uid, enabled: true }, prefer: 'resolution=merge-duplicates,return=representation' });
      return send(res, 200, { approved: true, faction: rows[0], request_id: requestId }, requestId);
    }

    return send(res, 404, { error: 'Unknown dashboard action.', request_id: requestId }, requestId);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error(`[dashboard ${requestId}]`, e?.message || e);
    return send(res, status, { error: e instanceof Error ? e.message : 'Unexpected dashboard error.', request_id: requestId }, requestId);
  }
}
