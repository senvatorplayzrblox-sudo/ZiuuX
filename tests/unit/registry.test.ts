import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// These tests need discord.js installed (they load the real command builders), so they are skipped when it is absent.
const require_ = createRequire(import.meta.url);
let hasDiscord = true;
try { require_.resolve('discord.js'); } catch { hasDiscord = false; }
const skip = hasDiscord ? false : 'discord.js is not installed in this environment';

test('every command key has exactly one implementation with a matching name and valid JSON', { skip }, async () => {
  const { ALL_COMMANDS } = await import('../../src/commands/index.js');
  const { buildRegistry, commandPayload } = await import('../../src/core/registry/CommandRegistry.js');
  const map = buildRegistry(ALL_COMMANDS); // throws on duplicates / missing keys / name != key
  assert.equal(map.size, ALL_COMMANDS.length);
  for (const c of commandPayload(ALL_COMMANDS)) {
    assert.ok(c.name.length <= 32 && c.description.length <= 100, `${c.name}: name/description limits`);
    assert.ok((c.options?.length ?? 0) <= 25);
  }
});

test('moderation commands declare required permissions; owner/config commands are never "public"', { skip }, async () => {
  const { ALL_COMMANDS } = await import('../../src/commands/index.js');
  const byKey = new Map(ALL_COMMANDS.map((c) => [c.key, c]));
  for (const k of ['warn', 'kick', 'ban', 'unban', 'timeout', 'untimeout', 'purge', 'lock', 'unlock', 'slowmode', 'warnings', 'removewarn', 'clearwarnings'] as const) {
    const c = byKey.get(k)!;
    assert.equal(c.access, 'moderation', k);
    assert.ok((c.requiredUserPerms?.length ?? 0) > 0, k);
  }
  assert.equal(byKey.get('botsettings')!.access, 'owner');
  for (const k of ['cmdconfig', 'aimod', 'setlogs', 'listlogs'] as const) assert.equal(byKey.get(k)!.access, 'config', k);
  assert.equal(byKey.get('staffpanel')!.access, 'staff');
});

test('pager buttons never duplicate custom ids', { skip }, async () => {
  const { pageButtons } = await import('../../src/ui/components/pagination.js');
  for (const [page, pages] of [[0, 1], [0, 3], [1, 3], [2, 3]] as const) {
    const ids = pageButtons(page, pages, (n) => `zx:sp:cases:${n}`).map((b) => (b.toJSON() as { custom_id: string }).custom_id);
    assert.equal(new Set(ids).size, ids.length, `page ${page}/${pages}`);
  }
});
