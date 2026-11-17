import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Integration tests against a REAL MongoDB. They need a replica set because case creation uses transactions
 * (an Atlas free cluster works). Point TEST_MONGODB_URI at a throw-away database, e.g.
 *   TEST_MONGODB_URI="mongodb+srv://.../ziuux_test" npm test
 * They are skipped (not faked) when the variable is unset.
 */
const uri = process.env.TEST_MONGODB_URI;
const skip = uri ? false : 'set TEST_MONGODB_URI to run database integration tests';

type Mods = {
  mongoose: typeof import('mongoose').default;
  models: typeof import('../../src/database/models/index.js');
  repos: typeof import('../../src/database/repositories/index.js');
  cases: import('../../src/services/CaseService.js').CaseService;
  warnings: import('../../src/services/WarningService.js').WarningService;
};
let m: Mods;
const A = '111111111111111111';
const B = '222222222222222222';
const U = '333333333333333333';
const MOD = '444444444444444444';

before(async () => {
  if (!uri) return;
  const mongoose = (await import('mongoose')).default;
  const models = await import('../../src/database/models/index.js');
  const repos = await import('../../src/database/repositories/index.js');
  const { CaseService } = await import('../../src/services/CaseService.js');
  const { WarningService } = await import('../../src/services/WarningService.js');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  // SAFETY: these tests call deleteMany({}) on every collection. Refuse unless the database is clearly disposable
  // (its name contains "test") and is not the database named in MONGODB_URI.
  const dbName = mongoose.connection.name;
  const prodName = (() => { try { return new URL(process.env.MONGODB_URI ?? '').pathname.replace(/^\//, ''); } catch { return ''; } })();
  if (!/test/i.test(dbName) || (prodName && prodName === dbName)) {
    await mongoose.disconnect();
    throw new Error(`Refusing to run: database "${dbName}" is not clearly disposable. Use a separate database whose name contains "test" (e.g. ziuux_test).`);
  }
  await Promise.all(models.ALL_MODELS.map((x) => x.init()));
  for (const x of models.ALL_MODELS) await x.deleteMany({});
  const cases = new CaseService();
  m = { mongoose, models, repos, cases, warnings: new WarningService(cases) };
});
after(async () => { if (m) await m.mongoose.disconnect(); });

const rec = (guildId: string) => m.cases.record({ guildId, type: 'kick', targetId: U, moderatorId: MOD, reason: 'x', source: 'manual', metadata: {}, dmDelivered: null });

test('case numbers are unique, gap-free and per guild even under concurrency', { skip }, async () => {
  const results = await Promise.all([...Array(20)].map((_, i) => rec(i % 2 ? A : B)));
  const numsA = results.filter((c) => c.guildId === A).map((c) => c.caseNumber).sort((x, y) => x - y);
  const numsB = results.filter((c) => c.guildId === B).map((c) => c.caseNumber).sort((x, y) => x - y);
  assert.deepEqual(numsA, [...Array(10)].map((_, i) => i + 1));
  assert.deepEqual(numsB, [...Array(10)].map((_, i) => i + 1));
});

test('guild isolation: data written for guild A is invisible to guild B', { skip }, async () => {
  await m.warnings.addWarning({ guildId: A, userId: U, moderatorId: MOD, reason: 'a-only', source: 'manual', dmDelivered: null });
  assert.equal((await m.warnings.list(A, U)).length, 1);
  assert.equal((await m.warnings.list(B, U)).length, 0);
  assert.equal(await m.repos.WarningRepo.countActive(B, U), 0);
  assert.equal(await m.repos.CaseRepo.find(B, 9999), null);
  const aCases = await m.repos.CaseRepo.listRecent(A, { limit: 100 });
  assert.ok(aCases.every((c) => c.guildId === A));
});

test('warning + case are written together; removing a warning is guild-scoped and atomic', { skip }, async () => {
  const c = await m.warnings.addWarning({ guildId: B, userId: U, moderatorId: MOD, reason: 'b warn', source: 'manual', dmDelivered: true });
  assert.equal((await m.repos.WarningRepo.findByCase(B, c.caseNumber))?.active, true);
  // guild A cannot remove guild B's warning, even with the right case number
  await assert.rejects(m.warnings.removeWarning({ guildId: A, caseNumber: c.caseNumber + 1000, moderatorId: MOD, reason: null, source: 'manual' }), /No active warning/);
  const removed = await m.warnings.removeWarning({ guildId: B, caseNumber: c.caseNumber, moderatorId: MOD, reason: 'ok', source: 'manual' });
  assert.equal(removed.case.type, 'removewarn');
  assert.equal(removed.case.targetId, U);
  await assert.rejects(m.warnings.removeWarning({ guildId: B, caseNumber: c.caseNumber, moderatorId: MOD, reason: null, source: 'manual' }), /No active warning/);
});

test('a failed transaction rolls the case counter back (no gaps)', { skip }, async () => {
  const before = (await m.repos.GuildSettingsRepo.ensure(B)).caseCounter;
  await assert.rejects(m.warnings.clearWarnings({ guildId: B, userId: '555555555555555555', moderatorId: MOD, reason: null, source: 'manual' }));
  assert.equal((await m.repos.GuildSettingsRepo.ensure(B)).caseCounter, before);
});

test('unique indexes: duplicate blocked words are rejected; AIConfig patch round-trips through normalization', { skip }, async () => {
  assert.equal(await m.repos.BlockedWordRepo.add(A, { term: 'Foo', normalized: 'foo', matchMode: 'word', addedBy: MOD }), true);
  assert.equal(await m.repos.BlockedWordRepo.add(A, { term: 'FOO', normalized: 'foo', matchMode: 'word', addedBy: MOD }), false);
  assert.equal(await m.repos.BlockedWordRepo.add(B, { term: 'Foo', normalized: 'foo', matchMode: 'word', addedBy: MOD }), true, 'same word in another guild is independent');
  const { AIConfigService } = await import('../../src/services/AIConfigService.js');
  const svc = new AIConfigService();
  await svc.setEnabled(A, true);
  await svc.setThreshold(A, 'hate', 0.66);
  await assert.rejects(svc.setAction(A, 'self_harm', 'timeout'), /alert-only/);
  const cfg = await svc.get(A);
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.categories.hate.threshold, 0.66);
  assert.equal(cfg.categories.self_harm.action, 'log');
  assert.equal((await new AIConfigService().get(B)).enabled, false, 'guild B untouched');
});

test('retention purge removes every guild-scoped collection for an expired guild', { skip }, async () => {
  const G = '666666666666666666';
  await m.repos.GuildSettingsRepo.ensure(G);
  await rec(G);
  await m.repos.GuildSettingsRepo.markInactive(G);
  await m.models.GuildSettingsModel.updateOne({ guildId: G }, { $set: { leftAt: new Date(Date.now() - 31 * 86_400_000) } });
  const { RetentionService } = await import('../../src/services/RetentionService.js');
  assert.ok((await new RetentionService().sweep()) >= 1);
  assert.equal(await m.models.CaseModel.countDocuments({ guildId: G }), 0);
  assert.equal(await m.models.GuildSettingsModel.countDocuments({ guildId: G }), 0);
  assert.ok((await m.models.CaseModel.countDocuments({ guildId: A })) > 0, 'other guilds keep their data');
});
