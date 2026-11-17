import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resolveConfigAccess } from '../../src/permissions/ownerAccess.js';

const OWNER = '1418875905085935637';

test('owner bypass applies to config-panel access only and only when Discord check fails', () => {
  assert.deepEqual(resolveConfigAccess({ userId: OWNER, ownerId: OWNER, discordAllowed: false }), { allowed: true, viaOwnerBypass: true });
  assert.deepEqual(resolveConfigAccess({ userId: OWNER, ownerId: OWNER, discordAllowed: true }), { allowed: true, viaOwnerBypass: false });
  assert.deepEqual(resolveConfigAccess({ userId: '999999999999999999', ownerId: OWNER, discordAllowed: false }), { allowed: false, viaOwnerBypass: false });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}
const root = join(process.cwd(), 'src');
// When running from .test-dist, locate the real source tree.
const srcRoot = (() => {
  try { statSync(root); return root; } catch { return join(process.cwd(), '..', 'src'); }
})();
const files = walk(srcRoot);

test('BOT_OWNER_ID / owner id is only referenced by config/env.ts and permissions/OwnerGate.ts', () => {
  const allowed = new Set(['config/env.ts', 'permissions/OwnerGate.ts']);
  const offenders = files
    .map((f) => ({ rel: relative(srcRoot, f).split('\\').join('/'), text: readFileSync(f, 'utf8') }))
    .filter((f) => /BOT_OWNER_ID/.test(f.text) && !allowed.has(f.rel))
    .map((f) => f.rel);
  assert.deepEqual(offenders, []);
});

test('the owner ID is never hard-coded in source', () => {
  const offenders = files.filter((f) => readFileSync(f, 'utf8').includes(OWNER)).map((f) => relative(srcRoot, f));
  assert.deepEqual(offenders, []);
});

test('moderation authorisation modules never import the owner gate, env, or owner access rule', () => {
  for (const rel of ['permissions/hierarchy.ts', 'permissions/policy.ts', 'permissions/PermissionService.ts', 'permissions/discordPerms.ts', 'services/ModerationService.ts']) {
    let text = '';
    try { text = readFileSync(join(srcRoot, rel), 'utf8'); } catch { continue; }
    assert.doesNotMatch(text, /OwnerGate|ownerAccess|config\/env|BOT_OWNER_ID|resolveConfigAccess/, `${rel} must not reference owner bypass`);
  }
});
