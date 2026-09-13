import assert from 'node:assert/strict';
import test from 'node:test';

import { DatabaseError, compileRestPath, compileRestRequest } from '../server/database.js';

test('compiles selected columns, filters, ordering and limits with bound values', () => {
  const query = compileRestPath('faction_members?select=user_id,faction_role&faction_id=eq.alpha&order=joined_at.asc&limit=12');
  assert.equal(query.table, 'faction_members');
  assert.equal(query.columns, '"user_id", "faction_role"');
  assert.equal(query.where, ' WHERE "faction_id" = $1');
  assert.equal(query.order, ' ORDER BY "joined_at" ASC');
  assert.equal(query.limit, ' LIMIT 12');
  assert.deepEqual(query.values, ['alpha']);
});

test('compiles IN and OR filters without interpolating values into SQL', () => {
  const query = compileRestPath('ownership_relationships?select=*&status=in.(active,pending)&or=(owner_id.eq.12345678901234567,sub_id.eq.12345678901234567)');
  assert.equal(query.where, ' WHERE "status" IN ($1, $2) AND ("owner_id" = $3 OR "sub_id" = $4)');
  assert.deepEqual(query.values, ['active', 'pending', '12345678901234567', '12345678901234567']);
  assert.equal(query.where.includes('12345678901234567'), false);
});

test('rejects tables, columns and directions outside the adapter grammar', () => {
  assert.throws(() => compileRestPath('not_a_bound_table?select=*'), DatabaseError);
  assert.throws(() => compileRestPath('factions?select=faction_id,(select pg_sleep(1))'), DatabaseError);
  assert.throws(() => compileRestPath('factions?select=*&order=power.sideways'), DatabaseError);
});

test('compiles composite-key upserts and serialises JSON arrays', () => {
  const upsert = compileRestRequest('tds_ticket_panels', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: [
      { guild_id: '123', panel_type: 'support', questions: ['What happened?'] },
      { guild_id: '123', panel_type: 'verify', questions: ['Server name?'] },
    ],
  });
  assert.match(upsert.text, /ON CONFLICT \("guild_id", "panel_type"\) DO UPDATE SET/);
  assert.equal(upsert.returnMinimal, true);
  assert.deepEqual(upsert.values.slice(2, 3), ['["What happened?"]']);
});

test('compiles parameterised updates and deletes', () => {
  const update = compileRestRequest('bdsm_safety_config?guild_id=eq.123', {
    method: 'PATCH', body: { blocked_channel_ids: ['456'] },
  });
  assert.equal(update.text, 'UPDATE "bdsm_safety_config" SET "blocked_channel_ids" = $2 WHERE "guild_id" = $1 RETURNING *');
  assert.deepEqual(update.values, ['123', '["456"]']);

  const remove = compileRestRequest('dashboard_guild_permissions?guild_id=eq.123&user_id=eq.456', { method: 'DELETE' });
  assert.equal(remove.text, 'DELETE FROM "dashboard_guild_permissions" WHERE "guild_id" = $1 AND "user_id" = $2 RETURNING *');
  assert.deepEqual(remove.values, ['123', '456']);
});
