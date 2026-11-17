import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateModeration, evaluateChannelAction, type PrincipalInfo } from '../../src/permissions/hierarchy.js';

const P = (id: string, pos: number, isGuildOwner = false): PrincipalInfo => ({ id, highestRolePosition: pos, isGuildOwner });
const bot = P('BOT', 10);
const base = { bot, actorHasPermission: true, botHasPermission: true };

test('allows when actor and bot are both strictly above the target', () => {
  assert.deepEqual(evaluateModeration({ ...base, actor: P('A', 5), target: P('T', 3) }), { allowed: true });
});
test('denies when actor lacks the Discord permission', () => {
  assert.deepEqual(evaluateModeration({ ...base, actorHasPermission: false, actor: P('A', 5), target: P('T', 3) }), { allowed: false, code: 'actor_missing_permission' });
});
test('denies when bot lacks the Discord permission', () => {
  assert.deepEqual(evaluateModeration({ ...base, botHasPermission: false, actor: P('A', 5), target: P('T', 3) }), { allowed: false, code: 'bot_missing_permission' });
});
test('denies self-targeting and targeting the bot', () => {
  assert.equal((evaluateModeration({ ...base, actor: P('A', 5), target: P('A', 5) }) as any).code, 'target_is_self');
  assert.equal((evaluateModeration({ ...base, actor: P('A', 5), target: P('BOT', 10) }) as any).code, 'target_is_bot');
});
test('denies targeting the guild owner, even for a high-role actor', () => {
  assert.equal((evaluateModeration({ ...base, actor: P('A', 9), target: P('O', 0, true) }) as any).code, 'target_is_guild_owner');
});
test('equal roles are denied (strictly-higher rule)', () => {
  assert.equal((evaluateModeration({ ...base, actor: P('A', 5), target: P('T', 5) }) as any).code, 'actor_hierarchy');
});
test('actor above target but bot not above target is denied on bot hierarchy', () => {
  assert.equal((evaluateModeration({ ...base, bot: P('BOT', 4), actor: P('A', 8), target: P('T', 6) }) as any).code, 'bot_hierarchy');
});
test('guild owner actor may act on lower targets but still needs the bot to outrank them', () => {
  assert.deepEqual(evaluateModeration({ ...base, actor: P('G', 0, true), target: P('T', 9) }), { allowed: true });
  assert.equal((evaluateModeration({ ...base, actor: P('G', 0, true), target: P('T', 10) }) as any).code, 'bot_hierarchy');
});
test('platform "not manageable" verdict is honoured', () => {
  assert.equal((evaluateModeration({ ...base, actor: P('A', 5), target: P('T', 3), platformManageable: false }) as any).code, 'target_not_manageable');
});
test('non-member target (position -1) only needs permissions', () => {
  assert.deepEqual(evaluateModeration({ ...base, actor: P('A', 1), target: P('X', -1) }), { allowed: true });
});
test('the ZiuuX bot owner id gets NO special treatment: a low-role "owner" is denied like anyone else', () => {
  const OWNER = '1418875905085935637';
  assert.equal((evaluateModeration({ ...base, actor: P(OWNER, 1), target: P('T', 5) }) as any).code, 'actor_hierarchy');
  assert.equal((evaluateModeration({ ...base, actorHasPermission: false, actor: P(OWNER, 99), target: P('T', 5) }) as any).code, 'actor_missing_permission');
  assert.equal((evaluateModeration({ ...base, botHasPermission: false, actor: P(OWNER, 99), target: P('T', 5) }) as any).code, 'bot_missing_permission');
  assert.equal((evaluateModeration({ ...base, actor: P(OWNER, 99), target: P('O', 0, true) }) as any).code, 'target_is_guild_owner');
});
test('AI as actor (bot acting) is still subject to hierarchy and self checks', () => {
  // Bot acting against an equal-position target: both the actor-hierarchy and bot-hierarchy rules deny it.
  assert.equal((evaluateModeration({ ...base, actor: bot, target: P('T', 10) }) as any).allowed, false);
  assert.deepEqual(evaluateModeration({ ...base, actor: bot, target: P('T', 3) }), { allowed: true });
  assert.equal((evaluateModeration({ ...base, actor: bot, target: bot }) as any).code, 'target_is_self');
});
test('channel actions need both actor and bot permissions', () => {
  assert.deepEqual(evaluateChannelAction({ actorHasPermission: true, botHasPermission: true }), { allowed: true });
  assert.equal((evaluateChannelAction({ actorHasPermission: false, botHasPermission: true }) as any).code, 'actor_missing_permission');
  assert.equal((evaluateChannelAction({ actorHasPermission: true, botHasPermission: false }) as any).code, 'bot_missing_permission');
});
