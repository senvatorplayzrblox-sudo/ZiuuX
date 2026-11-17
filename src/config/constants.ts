export const COLORS = {
  primary: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245,
  warning: 0xfee75c,
  info: 0x3498db,
  mod: 0xeb459e,
  neutral: 0x2b2d31,
} as const;

export const LIMITS = {
  reasonMax: 512,
  timeoutMaxMs: 28 * 24 * 60 * 60 * 1000,
  timeoutMinMs: 5 * 1000,
  slowmodeMaxSeconds: 21600,
  purgeMax: 100,
  banDeleteDaysMax: 7,
  blockedWordsMax: 200,
  blockedWordMaxLen: 64,
  exemptionsMax: 25,
  scopeChannelsMax: 25,
  staffRolesMax: 10,
  pageSize: 8,
  customIdMax: 100,
  historyEntries: 10,
} as const;

export const AI_LIMITS = {
  maxTextChars: 2000,
  minTextChars: 4,
  queueMax: 200,
  concurrency: 4,
  timeoutMs: 8000,
  guildRateMax: 30,
  guildRateWindowMs: 60_000,
  breakerThreshold: 5,
  breakerCooldownMs: 60_000,
  dedupeMs: 30_000,
  // Confidence safeguards (see ai/decision.ts)
  punitiveMinConfidence: 0.7,
  punitiveMinScore: 0.75,
  deleteMinConfidence: 0.5,
  alertMinConfidence: 0.5,
  excerptMax: 200,
  healthWindow: 20,
  healthMinSamples: 10,
  healthDegradedRatio: 0.5,
  timeoutSecondsMin: 60,
  timeoutSecondsMax: 24 * 60 * 60,
} as const;

export const RETENTION = {
  aiIncidentDays: 90,
  ownerAuditDays: 365,
  guildPurgeDays: 30,
} as const;

export const CACHE_TTL_MS = 45_000;
export const MARKER_TTL_MS = 15_000;
export const OWNER_AUDIT_DEDUPE_MS = 10 * 60 * 1000;
