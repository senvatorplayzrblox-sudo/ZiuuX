import type { AICategory } from '../config/aiCategories.js';
import type { AIProviderId } from '../config/aiModels.js';

export type FailureReason =
  | 'not_configured'
  | 'breaker_open'
  | 'queue_full'
  | 'guild_rate_limited'
  | 'timeout'
  | 'rate_limited'
  | 'http_error'
  | 'network'
  | 'invalid_output';

/** Normalized result. Provider-specific shapes never leave the adapters. */
export type ClassificationResult =
  | {
      ok: true;
      provider: AIProviderId;
      model: string;
      scores: Record<AICategory, number>;
      confidence: number;
      latencyMs: number;
    }
  | { ok: false; provider?: AIProviderId; reason: FailureReason; detail?: string };

export interface ClassifyInput {
  text: string;
  model: string;
  timeoutMs: number;
}
