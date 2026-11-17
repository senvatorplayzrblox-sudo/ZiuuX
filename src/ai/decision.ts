import { AI_LIMITS } from '../config/constants.js';
import {
  AI_CATEGORIES,
  CATEGORY_META,
  PUNITIVE_ACTIONS,
  SENSITIVITY_OFFSET,
  type AIAction,
  type AICategory,
  type GuildAIConfig,
} from '../config/aiCategories.js';

export interface PrimaryDecision {
  category: AICategory;
  score: number;
  threshold: number;
  configuredAction: AIAction;
  /** What will actually be executed (may be downgraded by the confidence safeguards). */
  action: AIAction;
  downgraded: boolean;
  downgradeReason: string | null;
}

export interface Decision {
  primary: PrimaryDecision | null;
  /** Alert-only. Never results in any punitive action or message removal. */
  selfHarm: { score: number; threshold: number } | null;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function effectiveThreshold(config: GuildAIConfig, category: AICategory): number {
  return clamp(config.categories[category].threshold + SENSITIVITY_OFFSET[config.sensitivity], 0.05, 0.99);
}

/**
 * PURE. Input must come from a successful, schema-validated classification: failures never reach this
 * function, which is how fail-open is enforced structurally.
 */
export function decide(scores: Record<AICategory, number>, confidence: number, config: GuildAIConfig): Decision {
  let selfHarm: Decision['selfHarm'] = null;
  let best: { category: AICategory; score: number; threshold: number } | null = null;

  for (const category of AI_CATEGORIES) {
    const cfg = config.categories[category];
    if (!cfg.enabled) continue;
    const score = scores[category];
    const threshold = effectiveThreshold(config, category);
    if (!(score >= threshold)) continue;

    if (CATEGORY_META[category].alertOnly) {
      if (confidence >= AI_LIMITS.alertMinConfidence) selfHarm = { score, threshold };
      continue;
    }
    if (!best || score > best.score) best = { category, score, threshold };
  }

  if (!best) return { primary: null, selfHarm };

  const configuredAction = config.categories[best.category].action;
  let action = configuredAction;
  let downgradeReason: string | null = null;

  if (PUNITIVE_ACTIONS.includes(configuredAction)) {
    if (confidence < AI_LIMITS.punitiveMinConfidence) {
      action = 'log';
      downgradeReason = `confidence ${confidence.toFixed(2)} below ${AI_LIMITS.punitiveMinConfidence} required for punitive actions`;
    } else if (best.score < AI_LIMITS.punitiveMinScore) {
      action = 'log';
      downgradeReason = `score ${best.score.toFixed(2)} below ${AI_LIMITS.punitiveMinScore} required for punitive actions`;
    }
  } else if (configuredAction === 'delete' && confidence < AI_LIMITS.deleteMinConfidence) {
    action = 'log';
    downgradeReason = `confidence ${confidence.toFixed(2)} below ${AI_LIMITS.deleteMinConfidence} required to delete`;
  }

  return {
    primary: {
      category: best.category,
      score: best.score,
      threshold: best.threshold,
      configuredAction,
      action,
      downgraded: action !== configuredAction,
      downgradeReason,
    },
    selfHarm,
  };
}
