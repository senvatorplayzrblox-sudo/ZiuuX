import type { AIProviderId } from '../config/aiModels.js';
import { AI_PROVIDER_IDS } from '../config/aiModels.js';
import { AIProviderHealthRepo } from '../database/repositories/index.js';
import type { AIClassifier } from '../ai/AIClassifier.js';
import type { HealthSnapshot } from '../ai/health.js';
import { childLogger } from '../utils/logger.js';

const log = childLogger('health');

export class HealthService {
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly classifier: AIClassifier) {}

  aiSnapshot(id: AIProviderId): HealthSnapshot {
    return this.classifier.snapshot(id);
  }
  allAi(): Array<{ id: AIProviderId; snapshot: HealthSnapshot }> {
    return AI_PROVIDER_IDS.map((id) => ({ id, snapshot: this.classifier.snapshot(id) }));
  }

  /** Persist changed provider health in batches (never once per message). */
  async flush(): Promise<void> {
    for (const { id, snapshot } of this.classifier.takeDirty()) {
      try {
        await AIProviderHealthRepo.upsert({
          provider: id,
          state: snapshot.state,
          consecutiveFailures: snapshot.consecutiveFailures,
          lastError: snapshot.lastError,
          lastSuccessAt: snapshot.lastSuccessAt ? new Date(snapshot.lastSuccessAt) : null,
          lastFailureAt: snapshot.lastFailureAt ? new Date(snapshot.lastFailureAt) : null,
          successes: snapshot.successes,
          failures: snapshot.failures,
        });
      } catch (err) {
        log.warn({ err }, 'failed to persist provider health');
      }
    }
  }

  start(intervalMs = 60_000): void {
    this.timer = setInterval(() => void this.flush(), intervalMs);
    this.timer.unref();
  }
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }
}
