import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { startHealthServer, setDiscordReady } from '../../src/bootstrap/healthServer.js';

test('/health is 503 until Discord AND MongoDB are ready, then 200; other paths 404; no sensitive data', async () => {
  let mongo = false;
  setDiscordReady(false);
  const server = startHealthServer(0, () => mongo);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const get = async (path: string) => { const r = await fetch(base + path); return { status: r.status, text: await r.text() }; };
    assert.equal((await get('/health')).status, 503);
    setDiscordReady(true);
    assert.equal((await get('/health')).status, 503, 'discord ready but mongo down');
    mongo = true;
    const ok = await get('/health');
    assert.equal(ok.status, 200);
    assert.deepEqual(JSON.parse(ok.text), { status: 'ok', discord: true, mongo: true });
    setDiscordReady(false);
    assert.equal((await get('/health')).status, 503, 'discord dropped');
    assert.equal((await get('/nope')).status, 404);
  } finally {
    server.close();
    setDiscordReady(false);
  }
});
