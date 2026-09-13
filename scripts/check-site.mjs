import { access, readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const pages = ['index.html', 'dashboard.html'];
const scripts = [
  'account-ui.js', 'auth-client.js', 'dashboard-access.js',
  'dashboard-config.js', 'dashboard-finish.js',
  'faction-control.js',
  'dashboard-polish.js', 'dashboard-runtime.js', 'dashboard.js', 'private-controls.js',
  'private-dashboard.js', 'reach.js', 'safety-live.js', 'script.js', 'showcase.js',
  'ticket-controls.js', 'welcome-auth.js',
  'api/account.js', 'api/dashboard.js', 'api/discord-oauth.js', 'api/gag-control.js',
  'api/leaderboards.js', 'api/personal-context.js',
  'api/private.js', 'api/profile.js', 'api/reach.js', 'api/safety-stats.js', 'api/tickets.js',
  'server/auth.js', 'server/database.js',
];

const errors = [];
for (const file of scripts) {
  const result = spawnSync(process.execPath, ['--check', resolve(root, file)], { encoding: 'utf8' });
  if (result.status !== 0) errors.push(`${file}: ${result.stderr.trim()}`);
}

for (const page of pages) {
  const source = await readFile(resolve(root, page), 'utf8');
  const ids = [...source.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicates.length) errors.push(`${page}: duplicate ids: ${duplicates.join(', ')}`);
  for (const match of source.matchAll(/\b(?:href|src)=["']([^"'#][^"']*)["']/g)) {
    const value = match[1];
    if (/^(?:https?:|data:|mailto:|\/\/)/.test(value)) continue;
    const clean = value.split(/[?#]/, 1)[0];
    if (!clean || extname(clean) === '') continue;
    try { await access(resolve(dirname(resolve(root, page)), clean)); }
    catch { errors.push(`${page}: missing local asset ${clean}`); }
  }
  for (const match of source.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
    if (!/\brel=["'][^"']*noopener[^"']*["']/i.test(match[0])) errors.push(`${page}: unsafe target="_blank" link`);
  }
}

const AUTH_OWNER = 'api/discord-oauth.js';
const authOwnerSource = await readFile(resolve(root, AUTH_OWNER), 'utf8');
if (!authOwnerSource.includes('DISCORD_CLIENT_SECRET')) errors.push(`${AUTH_OWNER}: must own the Discord token exchange`);
const dashboardSource = await readFile(resolve(root, 'dashboard.js'), 'utf8');
if ((dashboardSource.match(/startDiscordLogin\(/g) || []).length !== 1) errors.push('dashboard.js: Discord sign-in must have exactly one trigger');
const authClientCheckSource = await readFile(resolve(root, 'auth-client.js'), 'utf8');
if ((authClientCheckSource.match(/action=login/g) || []).length !== 1) errors.push('auth-client.js: must be the sole owner of the Discord login URL');
for (const file of scripts) {
  if (file === AUTH_OWNER) continue;
  const source = await readFile(resolve(root, file), 'utf8');
  if (source.includes('DISCORD_CLIENT_SECRET')) errors.push(`${file}: must not reference the Discord client secret`);
}
const authSource = await readFile(resolve(root, 'server/auth.js'), 'utf8');
for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax']) {
  if (!authSource.includes(flag)) errors.push(`server/auth.js: session cookie must set ${flag}`);
}
for (const file of scripts.filter(file => file.startsWith('api/'))) {
  const source = await readFile(resolve(root, file), 'utf8');
  if (source.includes('/rest/v1/')) errors.push(`${file}: website data must use Railway Postgres, not Supabase REST`);
}
for (const file of scripts) {
  const source = await readFile(resolve(root, file), 'utf8');
  if (/supabase\.co|supabase-js|\/auth\/v1\//i.test(source)) errors.push(`${file}: must not reference Supabase - Discord OAuth and sessions are self-hosted now`);
}
const databaseSource = await readFile(resolve(root, 'server/database.js'), 'utf8');
if (!databaseSource.includes('process.env.DATABASE_URL')) errors.push('server/database.js: Railway DATABASE_URL is required');

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${scripts.length} JavaScript files and ${pages.length} HTML pages.`);

