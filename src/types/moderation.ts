export const CASE_TYPES = [
  'warn', 'kick', 'ban', 'unban', 'timeout', 'untimeout', 'purge', 'lock', 'unlock', 'slowmode', 'removewarn', 'clearwarnings',
] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_SOURCES = ['manual', 'panel', 'ai', 'blocked_word'] as const;
export type CaseSource = (typeof CASE_SOURCES)[number];

export const isCaseType = (v: unknown): v is CaseType => typeof v === 'string' && (CASE_TYPES as readonly string[]).includes(v);

export interface CaseDoc {
  guildId: string;
  caseNumber: number;
  type: CaseType;
  /** User id, or null for channel-scoped actions (see metadata.channelId). */
  targetId: string | null;
  moderatorId: string;
  reason: string | null;
  source: CaseSource;
  metadata: Record<string, unknown>;
  dmDelivered: boolean | null;
  createdAt: Date;
}

export interface WarningDoc {
  guildId: string;
  userId: string;
  caseNumber: number;
  moderatorId: string;
  reason: string | null;
  active: boolean;
  removedAt: Date | null;
  removedBy: string | null;
  createdAt: Date;
}
