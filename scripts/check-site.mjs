import { access, readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const pages = ['index.html', 'dashboard.html'];
const scripts = [
  'account-ui.js', 'admin-auth-guard.js', 'auth-bridge.js', 'dashboard-access.js',
  'dashboard-auth-shell.js', 'dashboard-config.js', 'dashboard-finish.js',
  'faction-control.js',
  'dashboard-polish.js', 'dashboard-runtime.js', 'dashboard.js', 'private-controls.js',
  'private-dashboard.js', 'reach.js', 'safety-live.js', 'script.js', 'showcase.js',
  'supabase-client.js', 'ticket-controls.js', 'welcome-auth.js',
  'api/account.js', 'api/dashboard.js', 'api/discord-refresh.js', 'api/gag-control.js',
  'api/leaderboards.js', 'api/personal-context.js',
  'api/private.js', 'api/profile.js', 'api/reach.js', 'api/safety-stats.js', 'api/tickets.js',
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

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${scripts.length} JavaScript files and ${pages.length} HTML pages.`);

