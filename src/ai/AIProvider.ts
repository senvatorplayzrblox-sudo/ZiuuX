import type { AIProviderId } from '../config/aiModels.js';
import type { ClassificationResult, ClassifyInput } from './types.js';

export interface AIProvider {
  readonly id: AIProviderId;
  isConfigured(): boolean;
  /** Must NEVER throw: every failure is returned as { ok: false }. */
  classify(input: ClassifyInput): Promise<ClassificationResult>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
