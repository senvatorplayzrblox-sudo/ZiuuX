import type { ClientSession } from 'mongoose';
import { CaseRepo, GuildSettingsRepo, WarningRepo, type NewCase } from '../database/repositories/index.js';
import { withTransaction } from '../database/transaction.js';
import { LIMITS } from '../config/constants.js';
import type { CaseDoc, CaseType } from '../types/moderation.js';
import { paginate, type Page } from '../ui/components/pagination.js';

export type NewCaseInput = Omit<NewCase, 'caseNumber'>;
/** May write extra documents in the SAME transaction; its return value is merged into the case metadata. Throwing aborts everything. */
export type CaseExtra = (session: ClientSession, caseNumber: number) => Promise<Record<string, unknown> | void>;

export class CaseService {
  /** Allocates the per-guild case number and writes the case atomically (number is rolled back if anything fails). */
  async record(input: NewCaseInput, extra?: CaseExtra): Promise<CaseDoc> {
    // Ensure the settings document exists BEFORE the transaction so concurrent first cases can't race on its upsert.
    await GuildSettingsRepo.ensure(input.guildId);
    return withTransaction(async (session) => {
      const caseNumber = await GuildSettingsRepo.nextCaseNumber(input.guildId, session);
      const more = extra ? await extra(session, caseNumber) : undefined;
      return CaseRepo.create(input.guildId, { ...input, caseNumber, metadata: { ...(input.metadata ?? {}), ...(more ?? {}) } }, session);
    });
  }

  get(guildId: string, caseNumber: number): Promise<CaseDoc | null> {
    return CaseRepo.find(guildId, caseNumber);
  }

  historyFor(guildId: string, userId: string, limit: number = LIMITS.historyEntries): Promise<CaseDoc[]> {
    return CaseRepo.listByTarget(guildId, userId, limit);
  }

  async recent(guildId: string, page: number, type?: CaseType): Promise<Page<CaseDoc>> {
    const total = await CaseRepo.count(guildId, { type });
    const size = LIMITS.pageSize;
    const pages = Math.max(1, Math.ceil(total / size));
    const p = Math.min(Math.max(0, page), pages - 1);
    const items = await CaseRepo.listRecent(guildId, { type, skip: p * size, limit: size });
    return { items, page: p, pages, total };
  }

  async overview(guildId: string): Promise<{ cases24h: number; cases7d: number; activeWarnings: number; totalCases: number }> {
    const now = Date.now();
    const [cases24h, cases7d, activeWarnings, totalCases] = await Promise.all([
      CaseRepo.count(guildId, { since: new Date(now - 86_400_000) }),
      CaseRepo.count(guildId, { since: new Date(now - 7 * 86_400_000) }),
      WarningRepo.countActiveAll(guildId),
      CaseRepo.count(guildId),
    ]);
    return { cases24h, cases7d, activeWarnings, totalCases };
  }
}

export { paginate };
