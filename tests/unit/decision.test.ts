import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, effectiveThreshold } from '../../src/ai/decision.js';
import { AI_CATEGORIES, defaultAIConfig, normalizeAIConfig, type AICategory, type GuildAIConfig } from '../../src/config/aiCategories.js';

const zero = () => Object.fromEntries(AI_CATEGORIES.map((c) => [c, 0])) as Record<AICategory, number>;
const cfg = (patch: (c: GuildAIConfig) => void = () => {}): GuildAIConfig => {
  const c = defaultAIConfig('g1');
  c.enabled = true;
  patch(c);
  return c;
};

test('nothing flagged => no decision', () => {
  assert.deepEqual(decide(zero(), 0.99, cfg()), { primary: null, selfHarm: null });
});
test('score at/above threshold triggers the configured action', () => {
  const d = decide({ ...zero(), harassment: 0.9 }, 0.9, cfg());
  assert.equal(d.primary?.category, 'harassment');
  assert.equal(d.primary?.action, 'delete');
  assert.equal(d.primary?.downgraded, false);
});
test('disabled categories never trigger (profanity is off by default)', () => {
  assert.equal(decide({ ...zero(), profanity: 1 }, 1, cfg()).primary, null);
});
test('sensitivity shifts the threshold', () => {
  const c = cfg();
  assert.equal(effectiveThreshold(c, 'harassment'), 0.8);
  c.sensitivity = 'high';
  assert.ok(Math.abs(effectiveThreshold(c, 'harassment') - 0.7) < 1e-9);
  c.sensitivity = 'low';
  assert.ok(Math.abs(effectiveThreshold(c, 'harassment') - 0.9) < 1e-9);
  assert.equal(decide({ ...zero(), harassment: 0.85 }, 0.9, c).primary, null);
});
test('CONFIDENCE SAFEGUARD: uncertain classifications never produce punitive actions', () => {
  for (const action of ['warn', 'timeout'] as const) {
    const c = cfg((x) => { x.categories.harassment.action = action; });
    const d = decide({ ...zero(), harassment: 0.99 }, 0.5, c);
    assert.equal(d.primary?.action, 'log', action);
    assert.equal(d.primary?.downgraded, true);
    assert.equal(d.primary?.configuredAction, action);
  }
});
test('SCORE SAFEGUARD: low-score hits above a low threshold cannot be punitive', () => {
  const c = cfg((x) => { x.categories.harassment.action = 'timeout'; x.categories.harassment.threshold = 0.3; });
  const d = decide({ ...zero(), harassment: 0.5 }, 0.95, c);
  assert.equal(d.primary?.action, 'log');
});
test('confident, high-score punitive actions go through', () => {
  const c = cfg((x) => { x.categories.harassment.action = 'timeout'; });
  assert.equal(decide({ ...zero(), harassment: 0.95 }, 0.9, c).primary?.action, 'timeout');
});
test('low confidence downgrades delete to log', () => {
  assert.equal(decide({ ...zero(), harassment: 0.95 }, 0.3, cfg()).primary?.action, 'log');
});
test('self_harm is alert-only: raises an alert but never a primary/punitive decision', () => {
  const d = decide({ ...zero(), self_harm: 0.99 }, 0.9, cfg());
  assert.equal(d.primary, null);
  assert.ok(d.selfHarm);
});
test('self_harm cannot be made punitive even if the DB is tampered with', () => {
  const c = normalizeAIConfig('g1', { enabled: true, categories: { self_harm: { enabled: true, threshold: 0.1, action: 'timeout' } } });
  assert.equal(c.categories.self_harm.action, 'log');
  const d = decide({ ...zero(), self_harm: 1 }, 1, c);
  assert.equal(d.primary, null);
});
test('self_harm alert needs minimum confidence', () => {
  assert.equal(decide({ ...zero(), self_harm: 0.99 }, 0.2, cfg()).selfHarm, null);
});
test('highest-scoring category wins', () => {
  const d = decide({ ...zero(), harassment: 0.85, hate: 0.95 }, 0.9, cfg());
  assert.equal(d.primary?.category, 'hate');
});
test('normalizeAIConfig repairs garbage and clamps values', () => {
  const c = normalizeAIConfig('g1', {
    enabled: 'yes', sensitivity: 'extreme', timeoutSeconds: 99999999, exemptRoleIds: ['x', '123456789012345678', '123456789012345678'],
    categories: { harassment: { threshold: 5, action: 'ban' } }, alertChannelId: 'nope',
  });
  assert.equal(c.enabled, false);
  assert.equal(c.sensitivity, 'medium');
  assert.equal(c.timeoutSeconds, 86400);
  assert.deepEqual(c.exemptRoleIds, ['123456789012345678']);
  assert.equal(c.categories.harassment.threshold, 0.99);
  assert.equal(c.categories.harassment.action, 'delete');
  assert.equal(c.alertChannelId, null);
  assert.deepEqual(normalizeAIConfig('g1', null), defaultAIConfig('g1'));
});
