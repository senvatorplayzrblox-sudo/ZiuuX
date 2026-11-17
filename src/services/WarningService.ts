import { WarningRepo } from '../database/repositories/index.js';
import { BotError } from '../core/errors/BotError.js';
import type { CaseDoc, CaseSource, WarningDoc } from '../types/moderation.js';
import type { CaseService } from './CaseService.js';

export class WarningService {
  constructor(private readonly cases: CaseService) {}

  /** Case + Warning are written in ONE transaction. */
  addWarning(p: { guildId: string; userId: string; moderatorId: string; reason: string | null; source: CaseSource; dmDelivered: boolean | null; metadata?: Record<string, unknown> }): Promise<CaseDoc> {
    return this.cases.record(
      { guildId: p.guildId, type: 'warn', targetId: p.userId, moderatorId: p.moderatorId, reason: p.reason, source: p.source, metadata: p.metadata ?? {}, dmDelivered: p.dmDelivered },
      async (session, caseNumber) => {
        await WarningRepo.create(p.guildId, { guildId: p.guildId, userId: p.userId, caseNumber, moderatorId: p.moderatorId, reason: p.reason }, session);
      },
    );
  }

  list(guildId: string, userId: string, opts: { activeOnly?: boolean; limit?: number } = {}): Promise<WarningDoc[]> {
    return WarningRepo.listForUser(guildId, userId, { activeOnly: opts.activeOnly, limit: opts.limit ?? 25 });
  }

  countActive(guildId: string, userId: string): Promise<number> {
    return WarningRepo.countActive(guildId, userId);
  }

  /** Deactivates the warning and records a case atomically. Lookups are scoped to the guild, so IDs from other guilds are "not found". */
  async removeWarning(p: { guildId: string; caseNumber: number; moderatorId: string; reason: string | null; source: CaseSource }): Promise<{ case: CaseDoc; warning: WarningDoc }> {
    const existing = await WarningRepo.findByCase(p.guildId, p.caseNumber);
    if (!existing || !existing.active) throw new BotError('not_found', `No active warning with case #${p.caseNumber} exists in this server.`);
    const c = await this.cases.record(
      { guildId: p.guildId, type: 'removewarn', targetId: existing.userId, moderatorId: p.moderatorId, reason: p.reason, source: p.source, metadata: { warningCase: p.caseNumber }, dmDelivered: null },
      async (session) => {
        // Re-checked atomically: a concurrent removal makes this null and aborts the transaction.
        const done = await WarningRepo.deactivate(p.guildId, p.caseNumber, p.moderatorId, session);
        if (!done) throw new BotError('already_done', `Warning #${p.caseNumber} was already removed.`);
      },
    );
    return { case: c, warning: existing };
  }

  async clearWarnings(p: { guildId: string; userId: string; moderatorId: string; reason: string | null; source: CaseSource }): Promise<{ case: CaseDoc; cleared: number }> {
    let cleared = 0;
    const c = await this.cases.record(
      { guildId: p.guildId, type: 'clearwarnings', targetId: p.userId, moderatorId: p.moderatorId, reason: p.reason, source: p.source, metadata: {}, dmDelivered: null },
      async (session) => {
        cleared = await WarningRepo.deactivateAllForUser(p.guildId, p.userId, p.moderatorId, session);
        if (cleared === 0) throw new BotError('not_found', 'That user has no active warnings.');
        return { cleared };
      },
    );
    return { case: c, cleared };
  }
}
