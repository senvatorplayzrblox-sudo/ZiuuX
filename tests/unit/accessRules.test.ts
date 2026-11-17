import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCommandAccess, type CommandRule } from '../../src/permissions/accessRules.js';
import { COMMAND_KEYS, NON_CONFIGURABLE, CONFIGURABLE_KEYS } from '../../src/config/commandKeys.js';

const rule = (p: Partial<CommandRule> = {}): CommandRule => ({ commandKey: 'ban', enabled: true, roleIds: [], channelIds: [], ...p });

test('no rule => allowed', () => assert.equal(evaluateCommandAccess('ban', undefined, [], ['c1']).allowed, true));
test('disabled command is denied for everyone', () => {
  const r = evaluateCommandAccess('ban', rule({ enabled: false }), ['admin'], ['c1']);
  assert.equal(r.allowed, false);
  assert.equal((r as any).code, 'command_disabled');
});
test('role allow-list: member without a listed role is denied; with one is allowed', () => {
  const rl = rule({ roleIds: ['r1', 'r2'] });
  assert.equal(evaluateCommandAccess('ban', rl, ['x'], ['c1']).allowed, false);
  assert.equal(evaluateCommandAccess('ban', rl, ['x', 'r2'], ['c1']).allowed, true);
});
test('channel allow-list: other channel denied; allowed channel or thread parent allowed', () => {
  const rl = rule({ channelIds: ['c1'] });
  assert.equal(evaluateCommandAccess('ban', rl, [], ['c2']).allowed, false);
  assert.equal(evaluateCommandAccess('ban', rl, [], ['c1']).allowed, true);
  assert.equal(evaluateCommandAccess('ban', rl, [], ['thread9', 'c1']).allowed, true);
});
test('/cmdconfig and /botsettings can never be disabled or restricted (lockout protection)', () => {
  for (const k of NON_CONFIGURABLE) {
    const r = evaluateCommandAccess(k, { commandKey: k, enabled: false, roleIds: ['nope'], channelIds: ['nope'] }, [], ['c']);
    assert.equal(r.allowed, true);
  }
});
test('command key lists are consistent', () => {
  assert.equal(new Set(COMMAND_KEYS).size, COMMAND_KEYS.length);
  assert.equal(CONFIGURABLE_KEYS.length, COMMAND_KEYS.length - NON_CONFIGURABLE.length);
  assert.ok(CONFIGURABLE_KEYS.length <= 25, 'must fit in one select menu');
});
