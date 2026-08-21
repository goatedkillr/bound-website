import { createHash, randomUUID } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hpbqoochibnrxzxeuazb.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CQPZKB4Houc0UPn-sccxOQ_uZTD-X37';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.BOUND_BOT_TOKEN;
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
const DASHBOARD_PERMISSIONS = new Set(['view_dashboard', 'manage_settings', 'manage_safety', 'manage_factions']);

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
async function rpc(name, body) {
  return rest(`rpc/${name}`, { method: 'POST', body });
}
async function safe(q, f) { try { return await q(); } catch (e) { console.error('Optional dashboard query failed:', e?.message || e); return f; } }
async function permissionGrant(guildId, userId) {
  const rows = await rest(`dashboard_guild_permissions?select=guild_id,user_id,permissions,granted_by,updated_at&guild_id=eq.${guildId}&user_id=eq.${userId}&limit=1`);
  return rows?.[0] || null;
}
function hasPermission(grant, permission) {
  return Array.isArray(grant?.permissions) && grant.permissions.includes('view_dashboard') && grant.permissions.includes(permission);
}
async function authorisedGuild(providerToken, id, userId, permission = 'view_dashboard') {
  const gs = await discordGuilds(providerToken);
  const g = gs.find(x => x.id === id);
  if (!g) throw new HttpError(403, 'This Discord server is not available to your account.');
  if (g.owner) return { guild: g, access: { owner: true, permissions: [...DASHBOARD_PERMISSIONS] } };
  const grant = await permissionGrant(id, userId);
  if (!hasPermission(grant, permission)) throw new HttpError(403, 'The server owner has not granted this dashboard permission to you.');
  return { guild: g, access: { owner: false, permissions: grant.permissions } };
}

async function factionLeaderForGuild(guildId, userId) {
  const state = await factionForGuild(guildId);
  const faction = state.approved ? state.faction : null;
  if (!faction) return null;
  const rows = await rest(`faction_members?select=user_id,faction_id,faction_role&user_id=eq.${userId}&faction_id=eq.${encodeURIComponent(faction.faction_id)}&limit=1`);
  const member = rows?.[0];
  if (member?.faction_role !== 'leader' && faction.creator_id !== userId) return null;
  return { state, faction, member: member || { user_id: userId, faction_id: faction.faction_id, faction_role: 'leader' } };
}

async function authorisedFactionLeader(providerToken, guildId, userId) {
  const guilds = await discordGuilds(providerToken);
  const guild = guilds.find(x => x.id === guildId);
  if (!guild) throw new HttpError(403, 'You must still be a member of this Discord server.');
  const leader = await factionLeaderForGuild(guildId, userId);
  if (!leader) throw new HttpError(403, 'Only the approved faction leader can use these controls.');
  return { guild, ...leader };
}

function rpcResult(value) {
  const result = Array.isArray(value) ? value[0] : value;
  if (result?.success === false) throw new HttpError(400, result.message || 'The faction action could not be completed.');
  return result || {};
}
async function sendRewardDm(userId, balance) {
  if (!DISCORD_BOT_TOKEN) return 'unavailable';
  try {
    const channelResponse = await fetchTimed('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST', headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient_id: userId }),
    });
    if (!channelResponse.ok) return 'failed';
    const channel = await channelResponse.json();
    const messageResponse = await fetchTimed(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
      method: 'POST', headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [{ title: '10,000 global currency added', description: 'Thanks for connecting your Discord account to the Bound dashboard. Your one-time global economy reward is ready.', color: 15690692, fields: [{ name: 'New global balance', value: compactNumber(balance), inline: true }], footer: { text: 'Bound • Discord, but closer.' } }] }),
    });
    return messageResponse.ok ? 'sent' : 'failed';
  } catch { return 'failed'; }
}
async function claimDashboardReward(user) {
  const userId = discordUserId(user);
  const rows = await rpc('claim_dashboard_connect_reward', { p_user_id: userId, p_auth_user_id: user.id });
  const reward = rows?.[0] || { claimed: false, balance: 0, amount: 10000 };
  if (reward.claimed) {
    const dmStatus = await sendRewardDm(userId, reward.balance);
    await safe(() => rest(`dashboard_connect_rewards?user_id=eq.${userId}`, { method: 'PATCH', body: { dm_status: dmStatus, dm_attempted_at: new Date().toISOString() } }), null);
    reward.dm_status = dmStatus;
  }
  return reward;
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

async function buildFactionOnlyOverview(guild, guildId) {
  const full = await buildOverview(guild, guildId);
  return {
    guild: full.guild,
    settings: { guild_id: guildId, prefix: '£' },
    activation: null,
    verification: null,
    safety: { config: null, cases: [], pending: 0, cages: [], active_gags: [], gag_config: {} },
    faction: full.faction,
    economy: full.economy,
    activity: [],
    faction_only: true,
  };
}

async function factionCentre(guildId, uid) {
  const leader = await factionLeaderForGuild(guildId, uid);
  if (!leader) throw new HttpError(403, 'Only the approved faction leader can open the faction control centre.');
  const factionId = leader.faction.faction_id;
  const [members, balances, cache, applications, shop, market, portfolio, deposits] = await Promise.all([
    rest(`faction_members?select=user_id,faction_role,joined_at&faction_id=eq.${encodeURIComponent(factionId)}&order=joined_at.asc`),
    rest('user_balances?select=user_id,money'),
    rest('bdsm_discord_user_cache?select=user_id,display_name,avatar_url'),
    rest(`faction_applications?select=id,user_id,status,application_message,created_at&faction_id=eq.${encodeURIComponent(factionId)}&status=eq.pending&order=created_at.asc`),
    rpc('view_faction_shop', { p_viewer_user_id: uid }),
    rpc('view_faction_market', { p_user_id: uid }),
    rpc('view_faction_portfolio', { p_user_id: uid }),
    safe(() => rest(`faction_treasury_deposits?select=id,user_id,amount,created_at&faction_id=eq.${encodeURIComponent(factionId)}&order=created_at.desc&limit=12`), []),
  ]);
  const balancesByUser = new Map(balances.map(x => [x.user_id, Number(x.money || 0)]));
  const profiles = new Map(cache.map(x => [x.user_id, x]));
  const decorate = row => ({ ...row, display_name: profiles.get(row.user_id)?.display_name || row.user_id, avatar_url: profiles.get(row.user_id)?.avatar_url || null });
  return {
    leader: true,
    leader_user_id: uid,
    faction: leader.faction,
    personal_balance: balancesByUser.get(uid) || 0,
    members: members.map(x => ({ ...decorate(x), balance: balancesByUser.get(x.user_id) || 0 })),
    applications: applications.map(decorate),
    shop: rpcResult(shop),
    market: rpcResult(market),
    portfolio: rpcResult(portfolio),
    deposits: deposits.map(decorate),
  };
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
      const allGuilds = await discordGuilds(providerToken);
      const grants = await rest(`dashboard_guild_permissions?select=guild_id,permissions&user_id=eq.${uid}`);
      const grantMap = new Map(grants.map(x => [x.guild_id, x.permissions]));
      const leaderMemberships = await rest(`faction_members?select=faction_id,faction_role&user_id=eq.${uid}&faction_role=eq.leader`);
      const leaderFactionIds = leaderMemberships.map(x => x.faction_id);
      const leaderApprovals = leaderFactionIds.length ? await rest(`faction_server_approvals?select=guild_id,faction_id&enabled=eq.true&faction_id=in.(${leaderFactionIds.map(encodeURIComponent).join(',')})`) : [];
      const leaderGuildIds = new Set(leaderApprovals.map(x => x.guild_id));
      const guilds = allGuilds.filter(g => g.owner || grantMap.get(g.id)?.includes('view_dashboard') || leaderGuildIds.has(g.id));
      const ids = guilds.map(g => g.id);
      let activation = [], approvals = [];
      if (ids.length) {
        activation = await safe(() => rest(`bound_guild_activation?select=guild_id,tos_accepted&guild_id=in.(${ids.join(',')})`), []);
        approvals = await safe(() => rest(`faction_server_approvals?select=guild_id,faction_id,enabled&guild_id=in.(${ids.join(',')})&enabled=eq.true`), []);
      }
      const am = new Map(activation.map(x => [x.guild_id, x])), fm = new Map(approvals.map(x => [x.guild_id, x]));
      const reward = await claimDashboardReward(user);
      const payload = { user: { id: uid, username: user.user_metadata?.user_name || 'Discord user', display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.user_name || 'Discord user', avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null, is_bound_owner: BOUND_OWNER_IDS.has(uid) }, reward, guilds: guilds.map(g => { const factionLeader = leaderGuildIds.has(g.id); const permissions = g.owner ? [...DASHBOARD_PERMISSIONS] : [...new Set([...(grantMap.get(g.id) || []), ...(factionLeader ? ['view_dashboard', 'manage_factions'] : [])])]; return { id: g.id, name: g.name, icon_url: iconUrl(g), owner: g.owner, faction_leader: factionLeader, faction_only: factionLeader && !g.owner && !grantMap.get(g.id)?.includes('view_dashboard'), permissions, bound_installed: am.has(g.id), tos_accepted: am.get(g.id)?.tos_accepted || false, faction_status: fm.has(g.id) ? 'approved' : 'awaiting_owner_approval' }; }), request_id: requestId };
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
          try { payload.overview = leaderGuildIds.has(wantGuildId) && !targetGuild.owner && !grantMap.get(wantGuildId)?.includes('view_dashboard') ? await buildFactionOnlyOverview(targetGuild, wantGuildId) : await buildOverview(targetGuild, wantGuildId); }
          catch (e) { console.error('Bootstrap inline overview failed:', e?.message || e); }
        }
      }
      return send(res, 200, payload, requestId);
    }

    const guildId = validateGuildId(String(req.query.guild_id || ''));

    if (action === 'overview' && req.method === 'GET') {
      try {
        const { guild } = await authorisedGuild(providerToken, guildId, uid);
        return send(res, 200, { ...(await buildOverview(guild, guildId)), request_id: requestId }, requestId);
      } catch (error) {
        const { guild } = await authorisedFactionLeader(providerToken, guildId, uid);
        return send(res, 200, { ...(await buildFactionOnlyOverview(guild, guildId)), request_id: requestId }, requestId);
      }
    }

    if (action === 'faction_center' && req.method === 'GET') {
      await authorisedFactionLeader(providerToken, guildId, uid);
      return send(res, 200, { ...(await factionCentre(guildId, uid)), request_id: requestId }, requestId);
    }

    if (action === 'faction_member' && req.method === 'POST') {
      const { faction } = await authorisedFactionLeader(providerToken, guildId, uid);
      const memberAction = String(req.body?.member_action || '').toLowerCase();
      if (!['add', 'kick', 'promote', 'demote'].includes(memberAction)) return send(res, 400, { error: 'Unsupported member action.', request_id: requestId }, requestId);
      const target = validateSnowflakeOrNull(req.body?.target_user_id, 'Member Discord ID');
      if (!target || target === uid) return send(res, 400, { error: 'Choose another faction member.', request_id: requestId }, requestId);
      const result = rpcResult(await rpc('manage_faction_membership', { p_action: memberAction, p_actor_user_id: uid, p_target_user_id: target, p_faction_id: faction.faction_id }));
      return send(res, 200, { result, request_id: requestId }, requestId);
    }

    if (action === 'faction_application' && req.method === 'POST') {
      await authorisedFactionLeader(providerToken, guildId, uid);
      const reviewAction = String(req.body?.review_action || '').toLowerCase();
      if (!['approve', 'deny'].includes(reviewAction)) return send(res, 400, { error: 'Unsupported application action.', request_id: requestId }, requestId);
      const applicationId = Number(req.body?.application_id);
      if (!Number.isSafeInteger(applicationId) || applicationId <= 0) return send(res, 400, { error: 'Invalid application.', request_id: requestId }, requestId);
      const result = rpcResult(await rpc('review_faction_application', { p_action: reviewAction, p_reviewer_user_id: uid, p_application_id: applicationId }));
      return send(res, 200, { result, request_id: requestId }, requestId);
    }

    if (action === 'faction_deposit' && req.method === 'POST') {
      const { faction } = await authorisedFactionLeader(providerToken, guildId, uid);
      const amount = Number(req.body?.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1_000_000_000) return send(res, 400, { error: 'Deposit must be between 1 and 1,000,000,000.', request_id: requestId }, requestId);
      const result = rpcResult(await rpc('dashboard_deposit_to_faction', { p_user_id: uid, p_faction_id: faction.faction_id, p_amount: amount }));
      return send(res, 200, { result, request_id: requestId }, requestId);
    }

    if (action === 'faction_shop_buy' && req.method === 'POST') {
      await authorisedFactionLeader(providerToken, guildId, uid);
      const itemId = String(req.body?.item_id || '').trim();
      if (!itemId || itemId.length > 100) return send(res, 400, { error: 'Choose a valid shop item.', request_id: requestId }, requestId);
      const result = rpcResult(await rpc('buy_faction_shop_item', { p_buyer_user_id: uid, p_item_id: itemId }));
      return send(res, 200, { result, request_id: requestId }, requestId);
    }

    if (action === 'faction_market_trade' && req.method === 'POST') {
      await authorisedFactionLeader(providerToken, guildId, uid);
      const trade = String(req.body?.trade || '').toLowerCase(), ticker = String(req.body?.ticker || '').trim().toUpperCase(), shares = Number(req.body?.shares);
      if (!['buy', 'sell'].includes(trade) || !/^[A-Z0-9]{1,12}$/.test(ticker) || !Number.isSafeInteger(shares) || shares <= 0 || shares > 1_000_000) return send(res, 400, { error: 'Enter a valid market order.', request_id: requestId }, requestId);
      const fn = trade === 'buy' ? 'buy_faction_market_shares' : 'sell_faction_market_shares';
      const result = rpcResult(await rpc(fn, { p_user_id: uid, p_ticker: ticker, p_shares: shares }));
      return send(res, 200, { result, request_id: requestId }, requestId);
    }

    if (action === 'permissions' && req.method === 'GET') {
      const { guild, access } = await authorisedGuild(providerToken, guildId, uid);
      if (!guild.owner || !access.owner) return send(res, 403, { error: 'Only the Discord server owner can manage dashboard access.', request_id: requestId }, requestId);
      const rows = await rest(`dashboard_guild_permissions?select=guild_id,user_id,permissions,granted_by,created_at,updated_at&guild_id=eq.${guildId}&order=updated_at.desc`);
      const ids = rows.map(x => x.user_id);
      const profiles = ids.length ? await safe(() => rest(`bdsm_discord_user_cache?select=user_id,display_name,avatar_url&user_id=in.(${ids.join(',')})`), []) : [];
      const profileMap = new Map(profiles.map(x => [x.user_id, x]));
      return send(res, 200, { grants: rows.map(x => ({ ...x, profile: profileMap.get(x.user_id) || null })), request_id: requestId }, requestId);
    }

    if (action === 'permissions' && req.method === 'POST') {
      const { guild, access } = await authorisedGuild(providerToken, guildId, uid);
      if (!guild.owner || !access.owner) return send(res, 403, { error: 'Only the Discord server owner can manage dashboard access.', request_id: requestId }, requestId);
      const targetUserId = validateSnowflakeOrNull(req.body?.user_id, 'Discord user ID');
      if (!targetUserId) return send(res, 400, { error: 'Enter a Discord user ID.', request_id: requestId }, requestId);
      if (targetUserId === uid) return send(res, 400, { error: 'The server owner already has full dashboard access.', request_id: requestId }, requestId);
      if (req.body?.revoke === true) {
        await rest(`dashboard_guild_permissions?guild_id=eq.${guildId}&user_id=eq.${targetUserId}`, { method: 'DELETE', prefer: 'return=minimal' });
        return send(res, 200, { revoked: true, user_id: targetUserId, request_id: requestId }, requestId);
      }
      const requested = Array.isArray(req.body?.permissions) ? req.body.permissions.map(String) : [];
      if (requested.some(x => !DASHBOARD_PERMISSIONS.has(x))) return send(res, 400, { error: 'Unsupported dashboard permission.', request_id: requestId }, requestId);
      const permissions = [...new Set(['view_dashboard', ...requested])];
      const rows = await rest('dashboard_guild_permissions', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: { guild_id: guildId, user_id: targetUserId, permissions, granted_by: uid, updated_at: new Date().toISOString() } });
      return send(res, 200, { grant: rows?.[0] || { guild_id: guildId, user_id: targetUserId, permissions }, request_id: requestId }, requestId);
    }

    if (action === 'settings' && req.method === 'PATCH') {
      await authorisedGuild(providerToken, guildId, uid, 'manage_settings');
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
      if (group === 'verify') { await authorisedGuild(providerToken, guildId, uid, 'manage_settings'); const allowed = new Set(['welcome_enabled', 'post_verify_enabled', 'welcome_ping_user', 'safety_staff_setup_enabled']); if (!allowed.has(key)) return send(res, 400, { error: 'Unsupported verification setting.', request_id: requestId }, requestId); const rows = await patchOrInsert('verify_settings', guildId, { [key]: value }, { setup_by: uid }); return send(res, 200, { group, key, value: Boolean(rows?.[0]?.[key] ?? value), request_id: requestId }, requestId); }
      if (group === 'safety') { await authorisedGuild(providerToken, guildId, uid, 'manage_safety'); const allowed = new Set(['safety_enabled', 'auto_ban_minor_safety', 'auto_ban_harassment_tos', 'auto_ban_network_ban', 'auto_unban_on_removal']); if (!allowed.has(key)) return send(res, 400, { error: 'Unsupported safety setting.', request_id: requestId }, requestId); const rows = await patchOrInsert('safety_guilds', guildId, { [key]: value }, { configured_by: uid }); return send(res, 200, { group, key, value: Boolean(rows?.[0]?.[key] ?? value), request_id: requestId }, requestId); }
      if (group === 'faction') { let f; try { await authorisedGuild(providerToken, guildId, uid, 'manage_factions'); f = await factionForGuild(guildId); } catch { const leader = await authorisedFactionLeader(providerToken, guildId, uid); f = leader.state; } if (!f.approved) return send(res, 403, { error: 'Factions are awaiting Bound owner approval for this server.', request_id: requestId }, requestId); if (key !== 'applications_open') return send(res, 400, { error: 'Unsupported faction setting.', request_id: requestId }, requestId); const rows = await rest(`factions?faction_id=eq.${f.faction.faction_id}`, { method: 'PATCH', body: { applications_open: value, updated_at: new Date().toISOString() } }); return send(res, 200, { group, key, value: Boolean(rows?.[0]?.applications_open ?? value), request_id: requestId }, requestId); }
      return send(res, 400, { error: 'Unsupported setting group.', request_id: requestId }, requestId);
    }

    if (action === 'gag_config' && req.method === 'PATCH') {
      await authorisedGuild(providerToken, guildId, uid, 'manage_safety');
      const blockedRaw = Array.isArray(req.body?.blocked_channel_ids) ? req.body.blocked_channel_ids : [];
      if (blockedRaw.length > 50) return send(res, 400, { error: 'Too many blocked gag channels.', request_id: requestId }, requestId);
      const blocked = [...new Set(blockedRaw.map(x => validateSnowflakeOrNull(x, 'Blocked channel')).filter(Boolean))];
      const logChannel = validateSnowflakeOrNull(req.body?.log_channel_id, 'Gag log channel');
      const rows = await patchOrInsert('bdsm_safety_config', guildId, { blocked_channel_ids: blocked, log_channel_id: logChannel }, { configured_by: uid });
      return send(res, 200, { config: rows?.[0] || { guild_id: guildId, blocked_channel_ids: blocked, log_channel_id: logChannel }, request_id: requestId }, requestId);
    }

    if (action === 'faction_approve' && req.method === 'POST') {
      await authorisedGuild(providerToken, guildId, uid);
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

