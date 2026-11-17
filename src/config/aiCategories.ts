import { AI_LIMITS, LIMITS } from './constants.js';

export const AI_CATEGORIES = [
  'harassment',
  'hate',
  'sexual',
  'violence',
  'threats',
  'self_harm',
  'spam_scam',
  'profanity',
] as const;
export type AICategory = (typeof AI_CATEGORIES)[number];

/** log = record only; delete = remove message; warn = warn user; timeout = time the user out. */
export const AI_ACTIONS = ['log', 'delete', 'warn', 'timeout'] as const;
export type AIAction = (typeof AI_ACTIONS)[number];
export const PUNITIVE_ACTIONS: readonly AIAction[] = ['warn', 'timeout'];

export const SENSITIVITIES = ['low', 'medium', 'high'] as const;
export type Sensitivity = (typeof SENSITIVITIES)[number];
export const SENSITIVITY_OFFSET: Record<Sensitivity, number> = { low: 0.1, medium: 0, high: -0.1 };

export interface CategoryMeta {
  label: string;
  description: string;
  defaultThreshold: number;
  defaultAction: AIAction;
  defaultEnabled: boolean;
  /** self_harm is alert-only: never punitive, never configurable to be. */
  alertOnly: boolean;
}

export const CATEGORY_META: Record<AICategory, CategoryMeta> = {
  harassment: { label: 'Harassment', description: 'Insults, bullying, targeted abuse of a person.', defaultThreshold: 0.8, defaultAction: 'delete', defaultEnabled: true, alertOnly: false },
  hate: { label: 'Hate', description: 'Hateful content about protected groups or identities.', defaultThreshold: 0.8, defaultAction: 'delete', defaultEnabled: true, alertOnly: false },
  sexual: { label: 'Sexual', description: 'Sexually explicit content.', defaultThreshold: 0.85, defaultAction: 'delete', defaultEnabled: true, alertOnly: false },
  violence: { label: 'Violence', description: 'Graphic or glorified violence.', defaultThreshold: 0.85, defaultAction: 'delete', defaultEnabled: true, alertOnly: false },
  threats: { label: 'Threats', description: 'Credible threats of harm against others.', defaultThreshold: 0.8, defaultAction: 'delete', defaultEnabled: true, alertOnly: false },
  self_harm: { label: 'Self-harm', description: 'Possible self-harm or suicidal content. Alert-only, never punitive.', defaultThreshold: 0.7, defaultAction: 'log', defaultEnabled: true, alertOnly: true },
  spam_scam: { label: 'Spam / scam', description: 'Spam, phishing, scams, unsolicited promotion.', defaultThreshold: 0.85, defaultAction: 'delete', defaultEnabled: true, alertOnly: false },
  profanity: { label: 'Profanity', description: 'Strong profanity (can be noisy; off by default).', defaultThreshold: 0.9, defaultAction: 'log', defaultEnabled: false, alertOnly: false },
};

export function isAICategory(v: unknown): v is AICategory {
  return typeof v === 'string' && (AI_CATEGORIES as readonly string[]).includes(v);
}
export function isAIAction(v: unknown): v is AIAction {
  return typeof v === 'string' && (AI_ACTIONS as readonly string[]).includes(v);
}
export function isSensitivity(v: unknown): v is Sensitivity {
  return typeof v === 'string' && (SENSITIVITIES as readonly string[]).includes(v);
}

export interface CategoryConfig {
  enabled: boolean;
  threshold: number;
  action: AIAction;
}

export interface GuildAIConfig {
  guildId: string;
  enabled: boolean;
  sensitivity: Sensitivity;
  categories: Record<AICategory, CategoryConfig>;
  blockedWordAction: AIAction;
  timeoutSeconds: number;
  deleteOnPunish: boolean;
  alertChannelId: string | null;
  logChannelId: string | null;
  /** Empty = scan every channel. */
  scopeChannelIds: string[];
  exemptRoleIds: string[];
  exemptChannelIds: string[];
  exemptUserIds: string[];
}

export function defaultAIConfig(guildId: string): GuildAIConfig {
  const categories = {} as Record<AICategory, CategoryConfig>;
  for (const c of AI_CATEGORIES) {
    const m = CATEGORY_META[c];
    categories[c] = { enabled: m.defaultEnabled, threshold: m.defaultThreshold, action: m.defaultAction };
  }
  return {
    guildId,
    enabled: false,
    sensitivity: 'medium',
    categories,
    blockedWordAction: 'delete',
    timeoutSeconds: 600,
    deleteOnPunish: true,
    alertChannelId: null,
    logChannelId: null,
    scopeChannelIds: [],
    exemptRoleIds: [],
    exemptChannelIds: [],
    exemptUserIds: [],
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const idList = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && /^\d{17,20}$/.test(x)))].slice(0, max) : [];
const idOrNull = (v: unknown): string | null => (typeof v === 'string' && /^\d{17,20}$/.test(v) ? v : null);

/** Fill defaults / repair invalid persisted values. Never trusts the stored shape. */
export function normalizeAIConfig(guildId: string, raw: unknown): GuildAIConfig {
  const base = defaultAIConfig(guildId);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const cats = (r.categories && typeof r.categories === 'object' ? r.categories : {}) as Record<string, Record<string, unknown> | undefined>;
  for (const c of AI_CATEGORIES) {
    const stored = cats[c];
    if (!stored || typeof stored !== 'object') continue;
    const cur = base.categories[c];
    if (typeof stored.enabled === 'boolean') cur.enabled = stored.enabled;
    if (typeof stored.threshold === 'number' && Number.isFinite(stored.threshold)) cur.threshold = clamp(stored.threshold, 0.05, 0.99);
    if (isAIAction(stored.action)) cur.action = stored.action;
    if (CATEGORY_META[c].alertOnly) cur.action = 'log'; // enforced even if the DB was edited by hand
  }
  return {
    ...base,
    enabled: r.enabled === true,
    sensitivity: isSensitivity(r.sensitivity) ? r.sensitivity : base.sensitivity,
    blockedWordAction: isAIAction(r.blockedWordAction) ? r.blockedWordAction : base.blockedWordAction,
    timeoutSeconds:
      typeof r.timeoutSeconds === 'number' && Number.isFinite(r.timeoutSeconds)
        ? clamp(Math.round(r.timeoutSeconds), AI_LIMITS.timeoutSecondsMin, AI_LIMITS.timeoutSecondsMax)
        : base.timeoutSeconds,
    deleteOnPunish: typeof r.deleteOnPunish === 'boolean' ? r.deleteOnPunish : base.deleteOnPunish,
    alertChannelId: idOrNull(r.alertChannelId),
    logChannelId: idOrNull(r.logChannelId),
    scopeChannelIds: idList(r.scopeChannelIds, LIMITS.scopeChannelsMax),
    exemptRoleIds: idList(r.exemptRoleIds, LIMITS.exemptionsMax),
    exemptChannelIds: idList(r.exemptChannelIds, LIMITS.exemptionsMax),
    exemptUserIds: idList(r.exemptUserIds, LIMITS.exemptionsMax),
  };
}
