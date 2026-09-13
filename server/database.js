import { attachDatabasePool } from '@vercel/functions';
import pg from 'pg';

const { Pool } = pg;

const TABLES = new Set([
  'bdsm_active_gags', 'bdsm_discord_user_cache', 'bdsm_gag_user_stats', 'bdsm_safety_config',
  'bound_guild_activation', 'bound_private_build_controls', 'bound_private_dashboard_servers',
  'dashboard_accounts', 'dashboard_connect_rewards', 'dashboard_guild_permissions',
  'data_deletion_requests', 'faction_applications', 'faction_heist_statistics', 'faction_members',
  'faction_server_approvals', 'faction_stock_portfolios', 'faction_treasury_deposits',
  'faction_upgrades', 'factions', 'game_activity_history', 'guild_settings', 'ownership_cages',
  'ownership_profiles', 'ownership_relationships', 'premium_dashboard_guilds', 'rp_action_counts',
  'safety_cases', 'safety_guilds', 'safety_team', 'tds_economy_accounts', 'tds_moderation_cases',
  'tds_staff_members', 'tds_staff_shifts', 'tds_subscriptions', 'tds_ticket_panels',
  'tds_ticket_settings', 'tds_tickets', 'user_balances', 'verify_settings',
]);

const PRIMARY_KEYS = new Map([
  ['bdsm_active_gags', ['gagged_user_id']],
  ['bdsm_discord_user_cache', ['user_id']],
  ['bdsm_gag_user_stats', ['user_id']],
  ['bdsm_safety_config', ['guild_id']],
  ['bound_guild_activation', ['guild_id']],
  ['bound_private_build_controls', ['guild_id']],
  ['bound_private_dashboard_servers', ['guild_id']],
  ['dashboard_accounts', ['auth_user_id']],
  ['dashboard_connect_rewards', ['user_id']],
  ['dashboard_guild_permissions', ['guild_id', 'user_id']],
  ['data_deletion_requests', ['id']],
  ['faction_applications', ['id']],
  ['faction_heist_statistics', ['faction_id']],
  ['faction_members', ['user_id']],
  ['faction_server_approvals', ['guild_id']],
  ['faction_stock_portfolios', ['faction_id', 'ticker']],
  ['faction_treasury_deposits', ['id']],
  ['faction_upgrades', ['faction_id', 'upgrade_type']],
  ['factions', ['faction_id']],
  ['game_activity_history', ['id']],
  ['guild_settings', ['guild_id']],
  ['ownership_cages', ['guild_id', 'sub_id']],
  ['ownership_profiles', ['user_id']],
  ['ownership_relationships', ['relationship_id']],
  ['premium_dashboard_guilds', ['guild_id']],
  ['rp_action_counts', ['action', 'actor_user_id', 'target_user_id']],
  ['safety_cases', ['case_id']],
  ['safety_guilds', ['guild_id']],
  ['safety_team', ['user_id']],
  ['tds_economy_accounts', ['guild_id', 'user_id']],
  ['tds_moderation_cases', ['id']],
  ['tds_staff_members', ['guild_id', 'user_id']],
  ['tds_staff_shifts', ['id']],
  ['tds_subscriptions', ['guild_id', 'user_id']],
  ['tds_ticket_panels', ['guild_id', 'panel_type']],
  ['tds_ticket_settings', ['guild_id']],
  ['tds_tickets', ['id']],
  ['user_balances', ['user_id']],
  ['verify_settings', ['guild_id']],
]);

const JSON_COLUMNS = new Set([
  'bdsm_safety_config.blocked_channel_ids',
  'bound_private_build_controls.modules',
  'tds_ticket_panels.button_options',
  'tds_ticket_panels.questions',
  'tds_ticket_settings.category_overrides',
]);

const RPCS = new Map([
  ['buy_faction_market_shares', { args: ['p_user_id', 'p_ticker', 'p_shares'] }],
  ['buy_faction_shop_item', { args: ['p_buyer_user_id', 'p_item_id'] }],
  ['claim_dashboard_connect_reward', { args: ['p_user_id', 'p_auth_user_id'], rows: true }],
  ['dashboard_deposit_to_faction', { args: ['p_user_id', 'p_faction_id', 'p_amount'] }],
  ['manage_faction_membership', { args: ['p_action', 'p_actor_user_id', 'p_target_user_id', 'p_faction_id'] }],
  ['review_faction_application', { args: ['p_action', 'p_reviewer_user_id', 'p_application_id'] }],
  ['sell_faction_market_shares', { args: ['p_user_id', 'p_ticker', 'p_shares'] }],
  ['view_faction_market', { args: ['p_user_id'] }],
  ['view_faction_portfolio', { args: ['p_user_id'] }],
  ['view_faction_shop', { args: ['p_viewer_user_id'] }],
]);

const FILTER_OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'is', 'in']);
const RESERVED_QUERY_KEYS = new Set(['select', 'order', 'limit']);
let pool;

export class DatabaseError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function identifier(value, kind = 'identifier') {
  const name = String(value || '');
  if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new DatabaseError(400, `Invalid database ${kind}.`);
  return `"${name}"`;
}

function tableIdentifier(value) {
  if (!TABLES.has(value)) throw new DatabaseError(400, 'Unsupported dashboard data source.');
  return identifier(value, 'table');
}

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseError(503, 'Railway database connection is not configured.');
  const internal = connectionString.includes('.railway.internal');
  pool = new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    ssl: internal || process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
  });
  attachDatabasePool(pool);
  return pool;
}

function normaliseError(error) {
  if (error instanceof DatabaseError) return error;
  const status = error?.code === '23505' || error?.code === '23503' ? 409
    : error?.code === '22P02' || error?.code === '22003' ? 400
      : 502;
  const message = status === 409 ? 'That database record conflicts with an existing record.'
    : status === 400 ? 'One of the database values is invalid.'
      : 'Railway database request failed.';
  const wrapped = new DatabaseError(status, message);
  wrapped.cause = error;
  return wrapped;
}

function addValue(values, value) {
  values.push(value);
  return `$${values.length}`;
}

function parseFilter(columnName, expression, values) {
  const dot = expression.indexOf('.');
  if (dot < 1) throw new DatabaseError(400, 'Invalid database filter.');
  const operator = expression.slice(0, dot);
  const raw = expression.slice(dot + 1);
  if (!FILTER_OPERATORS.has(operator)) throw new DatabaseError(400, 'Unsupported database filter.');
  const column = identifier(columnName, 'column');
  if (operator === 'is') {
    if (raw === 'null') return `${column} IS NULL`;
    if (raw === 'true') return `${column} IS TRUE`;
    if (raw === 'false') return `${column} IS FALSE`;
    throw new DatabaseError(400, 'Unsupported database identity filter.');
  }
  if (operator === 'in') {
    if (!raw.startsWith('(') || !raw.endsWith(')')) throw new DatabaseError(400, 'Invalid database list filter.');
    const items = raw.slice(1, -1).split(',').map(value => value.trim()).filter(Boolean);
    if (!items.length || items.length > 500) throw new DatabaseError(400, 'Invalid database list filter.');
    return `${column} IN (${items.map(value => addValue(values, value)).join(', ')})`;
  }
  const sqlOperator = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[operator];
  return `${column} ${sqlOperator} ${addValue(values, raw)}`;
}

function splitOrFilters(raw) {
  const value = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw;
  return value.split(',').filter(Boolean).map(part => {
    const first = part.indexOf('.'), second = part.indexOf('.', first + 1);
    if (first < 1 || second < first + 2) throw new DatabaseError(400, 'Invalid database OR filter.');
    return { column: part.slice(0, first), expression: `${part.slice(first + 1, second)}.${part.slice(second + 1)}` };
  });
}

export function compileRestPath(path) {
  const parsed = new URL(String(path || ''), 'https://database.invalid/');
  const table = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const values = [];
  const where = [];
  for (const [key, expression] of parsed.searchParams) {
    if (RESERVED_QUERY_KEYS.has(key)) continue;
    if (key === 'or') {
      const alternatives = splitOrFilters(expression).map(filter => parseFilter(filter.column, filter.expression, values));
      where.push(`(${alternatives.join(' OR ')})`);
      continue;
    }
    where.push(parseFilter(key, expression, values));
  }
  const selectValue = parsed.searchParams.get('select') || '*';
  const columns = selectValue === '*' ? '*' : selectValue.split(',').map(column => identifier(column.trim(), 'column')).join(', ');
  let order = '';
  const orderValue = parsed.searchParams.get('order');
  if (orderValue) {
    const terms = orderValue.split(',').map(term => {
      const [column, direction = 'asc'] = term.split('.');
      if (!['asc', 'desc'].includes(direction)) throw new DatabaseError(400, 'Invalid database sort direction.');
      return `${identifier(column, 'column')} ${direction.toUpperCase()}`;
    });
    order = ` ORDER BY ${terms.join(', ')}`;
  }
  let limit = '';
  const limitValue = parsed.searchParams.get('limit');
  if (limitValue !== null) {
    const count = Number(limitValue);
    if (!Number.isSafeInteger(count) || count < 0 || count > 10_000) throw new DatabaseError(400, 'Invalid database result limit.');
    limit = ` LIMIT ${count}`;
  }
  return { table, tableSql: tableIdentifier(table), columns, values, where: where.length ? ` WHERE ${where.join(' AND ')}` : '', order, limit };
}

function bodyRows(body) {
  const rows = Array.isArray(body) ? body : [body];
  if (!rows.length || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new DatabaseError(400, 'Invalid database record.');
  const keys = Object.keys(rows[0]);
  if (!keys.length || rows.some(row => Object.keys(row).length !== keys.length || keys.some(key => !(key in row)))) throw new DatabaseError(400, 'Database records must use the same fields.');
  return { rows, keys };
}

function prepareValue(table, column, value) {
  if (value !== null && value !== undefined && JSON_COLUMNS.has(`${table}.${column}`)) return JSON.stringify(value);
  return value;
}

export function compileRestRequest(path, { method = 'GET', body, prefer = 'return=representation' } = {}) {
  const compiled = compileRestPath(path);
  const values = [...compiled.values];
  let text;
  const verb = String(method).toUpperCase();
  if (verb === 'GET') {
    text = `SELECT ${compiled.columns} FROM ${compiled.tableSql}${compiled.where}${compiled.order}${compiled.limit}`;
  } else if (verb === 'POST') {
    const records = bodyRows(body);
    const columns = records.keys.map(key => identifier(key, 'column'));
    const tuples = records.rows.map(row => `(${records.keys.map(key => addValue(values, prepareValue(compiled.table, key, row[key]))).join(', ')})`);
    text = `INSERT INTO ${compiled.tableSql} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`;
    if (String(prefer).includes('resolution=merge-duplicates')) {
      const primaryKeys = PRIMARY_KEYS.get(compiled.table);
      if (!primaryKeys?.every(key => records.keys.includes(key))) throw new DatabaseError(400, 'This database record cannot be upserted safely.');
      const updates = records.keys.filter(key => !primaryKeys.includes(key));
      text += ` ON CONFLICT (${primaryKeys.map(key => identifier(key, 'column')).join(', ')}) `;
      text += updates.length ? `DO UPDATE SET ${updates.map(key => `${identifier(key, 'column')} = EXCLUDED.${identifier(key, 'column')}`).join(', ')}` : 'DO NOTHING';
    }
    text += ' RETURNING *';
  } else if (verb === 'PATCH') {
    const record = bodyRows(body);
    if (record.rows.length !== 1) throw new DatabaseError(400, 'Database updates require one record.');
    const set = record.keys.map(key => `${identifier(key, 'column')} = ${addValue(values, prepareValue(compiled.table, key, record.rows[0][key]))}`);
    text = `UPDATE ${compiled.tableSql} SET ${set.join(', ')}${compiled.where} RETURNING *`;
  } else if (verb === 'DELETE') {
    text = `DELETE FROM ${compiled.tableSql}${compiled.where} RETURNING *`;
  } else {
    throw new DatabaseError(405, 'Unsupported database operation.');
  }
  return { text, values, returnMinimal: String(prefer).includes('return=minimal') };
}

export async function databaseRest(path, options = {}) {
  const request = compileRestRequest(path, options);
  try {
    const result = await getPool().query(request.text, request.values);
    return request.returnMinimal ? [] : result.rows;
  } catch (error) {
    throw normaliseError(error);
  }
}

export async function databaseCount(table, query = '') {
  const compiled = compileRestPath(`${table}?select=*${query}`);
  try {
    const result = await getPool().query(`SELECT COUNT(*)::int AS count FROM ${compiled.tableSql}${compiled.where}`, compiled.values);
    return Number(result.rows[0]?.count || 0);
  } catch (error) {
    throw normaliseError(error);
  }
}

export async function databaseRpc(name, body = {}) {
  const definition = RPCS.get(name);
  if (!definition) throw new DatabaseError(400, 'Unsupported Railway database function.');
  const values = definition.args.map(arg => body[arg]);
  const argumentsSql = definition.args.map((arg, index) => `${identifier(arg, 'function argument')} => $${index + 1}`).join(', ');
  try {
    if (definition.rows) {
      const result = await getPool().query(`SELECT * FROM ${identifier(name, 'function')}(${argumentsSql})`, values);
      return result.rows;
    }
    const result = await getPool().query(`SELECT ${identifier(name, 'function')}(${argumentsSql}) AS value`, values);
    return result.rows[0]?.value ?? null;
  } catch (error) {
    throw normaliseError(error);
  }
}
