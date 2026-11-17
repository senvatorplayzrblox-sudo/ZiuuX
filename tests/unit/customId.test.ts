import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomId, parseCustomId } from '../../src/interactions/customId.js';

test('round-trips module/action/args', () => {
  const id = buildCustomId('sp', 'act', 'ban', '123456789012345678');
  assert.equal(id, 'zx:sp:act:ban:123456789012345678');
  assert.deepEqual(parseCustomId(id), { module: 'sp', action: 'act', args: ['ban', '123456789012345678'] });
});
test('supports args with underscores (AI categories)', () => {
  assert.deepEqual(parseCustomId(buildCustomId('am', 'thr', 'self_harm')), { module: 'am', action: 'thr', args: ['self_harm'] });
});
test('rejects foreign prefixes, unknown modules, bad characters and oversize ids', () => {
  assert.equal(parseCustomId('other:sp:x'), null);
  assert.equal(parseCustomId('zx:zz:x'), null);
  assert.equal(parseCustomId('zx:sp:a b'), null);
  assert.equal(parseCustomId('zx:sp'), null);
  assert.equal(parseCustomId('zx:sp:' + 'a'.repeat(120)), null);
});
test('build refuses invalid segments and over-long ids', () => {
  assert.throws(() => buildCustomId('sp', 'a:b'));
  assert.throws(() => buildCustomId('sp', 'act', 'x'.repeat(95)));
});
test('longest ids we generate fit in 100 chars', () => {
  const id = buildCustomId('sp', 'chact', 'slowmode', '123456789012345678', '12345678901234567890');
  assert.ok(id.length <= 100);
});
