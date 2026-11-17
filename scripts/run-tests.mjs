// Cross-platform / cross-Node-version test runner (no glob support needed).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.test.js')) out.push(p);
  }
  return out;
}

const files = walk('.test-dist/tests');
if (files.length === 0) {
  console.error('No compiled tests found. Run `npm test` (which compiles first).');
  process.exit(1);
}
const res = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(res.status ?? 1);
