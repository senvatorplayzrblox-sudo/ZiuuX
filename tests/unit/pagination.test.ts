import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// pagination.ts imports discord.js builders, so we assert on its source here (a behavioural test runs in registry.test.ts when discord.js is installed).
const src = (() => {
  for (const base of [process.cwd(), join(process.cwd(), '..')]) {
    try { return readFileSync(join(base, 'src/ui/components/pagination.ts'), 'utf8'); } catch { /* try next */ }
  }
  throw new Error('pagination.ts not found');
})();

test('pager never emits duplicate custom ids: disabled buttons use distinct placeholders', () => {
  assert.match(src, /zx:noop:prev/);
  assert.match(src, /zx:noop:next/);
  assert.match(src, /zx:noop:page/);
  assert.match(src, /hasPrev \? idFor\(page - 1\)/);
  assert.match(src, /hasNext \? idFor\(page \+ 1\)/);
});
