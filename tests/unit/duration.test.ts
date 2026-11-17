import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDuration, formatDuration } from '../../src/utils/duration.js';
import { parseSnowflake } from '../../src/utils/snowflake.js';
import { parseEnv } from '../../src/config/env.js';

test('parseDuration', () => {
  assert.equal(parseDuration('10m'), 600_000);
  assert.equal(parseDuration('1h30m'), 5_400_000);
  assert.equal(parseDuration(' 2D '), 172_800_000);
  assert.equal(parseDuration('1w'), 604_800_000);
  for (const bad of ['', '10', 'abc', '0m', '-5m', '5x', '1h 30', 'm10']) assert.equal(parseDuration(bad), null, bad);
});
test('formatDuration', () => {
  assert.equal(formatDuration(5_400_000), '1h 30m');
  assert.equal(formatDuration(90_000), '1m 30s');
});
test('parseSnowflake accepts ids and mentions', () => {
  assert.equal(parseSnowflake('123456789012345678'), '123456789012345678');
  assert.equal(parseSnowflake('<@!123456789012345678>'), '123456789012345678');
  assert.equal(parseSnowflake('hello'), null);
  assert.equal(parseSnowflake('123'), null);
});
test('parseEnv validates and treats empty optional values as unset', () => {
  const ok = parseEnv({ DISCORD_TOKEN: 'x'.repeat(30), CLIENT_ID: '123456789012345678', MONGODB_URI: 'mongodb+srv://u:p@c.mongodb.net/db', BOT_OWNER_ID: '1418875905085935637', GEMINI_API_KEY: '', OPENAI_API_KEY: 'k', GUILD_ID: '' });
  assert.equal(ok.GEMINI_API_KEY, undefined);
  assert.equal(ok.OPENAI_API_KEY, 'k');
  assert.equal(ok.GUILD_ID, undefined);
  assert.equal(ok.PORT, 3000);
  assert.throws(() => parseEnv({}), /DISCORD_TOKEN/);
  assert.throws(() => parseEnv({ DISCORD_TOKEN: 'x'.repeat(30), CLIENT_ID: 'abc', MONGODB_URI: 'http://nope', BOT_OWNER_ID: '1' }), /CLIENT_ID[\s\S]*MONGODB_URI[\s\S]*BOT_OWNER_ID/);
});
