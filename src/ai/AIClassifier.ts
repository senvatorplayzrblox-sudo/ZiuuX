import { AI_LIMITS } from '../config/constants.js';
import type { AIProviderId } from '../config/aiModels.js';
import type { ProviderRegistry } from './ProviderRegistry.js';
import { CircuitBreaker } from './circuitBreaker.js';
import { ProviderHealth, type HealthSnapshot } from './health.js';
import type { ClassificationResult } from './types.js';

export interface ClassifierOptions {
  timeoutMs?: number;
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

/**
 * Single entry point for classification: provider lookup -> circuit breaker -> timeout'd call -> health bookkeeping.
 * Never throws; every failure is a { ok:false } result which callers treat as "take no action".
 */
export class AIClassifier {
  private readonly health = new Map<AIProviderId, ProviderHealth>();

  constructor(
    private readonly registry: ProviderRegistry,
    private readonly opts: ClassifierOptions = {},
  ) {}

  healthFor(id: AIProviderId): ProviderHealth {
    let h = this.health.get(id);
    if (!h) {
      h = new ProviderHealth(
        new CircuitBreaker({
          failureThreshold: this.opts.failureThreshold ?? AI_LIMITS.breakerThreshold,
          cooldownMs: this.opts.cooldownMs ?? AI_LIMITS.breakerCooldownMs,
          now: this.opts.now,
        }),
        this.opts.now,
      );
      this.health.set(id, h);
    }
    return h;
  }

  snapshot(id: AIProviderId): HealthSnapshot {
    return this.healthFor(id).snapshot(this.registry.isConfigured(id));
  }

  /** `bypassBreaker` is used only by the owner's explicit connectivity test. */
  async classify(provider: AIProviderId, model: string, text: string, bypassBreaker = false): Promise<ClassificationResult> {
    const adapter = this.registry.get(provider);
    if (!adapter) return { ok: false, provider, reason: 'not_configured' };

    const health = this.healthFor(provider);
    const acquired = bypassBreaker ? true : health.breaker.tryAcquire();
    if (!acquired) return { ok: false, provider, reason: 'breaker_open' };

    let result: ClassificationResult;
    try {
      result = await adapter.classify({ text, model, timeoutMs: this.opts.timeoutMs ?? AI_LIMITS.timeoutMs });
    } catch (err) {
      // Adapters must not throw, but fail-open regardless.
      result = { ok: false, provider, reason: 'network', detail: err instanceof Error ? err.message.slice(0, 200) : 'unknown error' };
    }

    if (result.ok) health.recordSuccess();
    else health.recordFailure(result.reason, result.detail);
    return result;
  }

  /** Providers whose counters changed since the last flush. */
  takeDirty(): Array<{ id: AIProviderId; snapshot: HealthSnapshot }> {
    const out: Array<{ id: AIProviderId; snapshot: HealthSnapshot }> = [];
    for (const [id, h] of this.health) {
      if (!h.dirty) continue;
      h.dirty = false;
      out.push({ id, snapshot: h.snapshot(this.registry.isConfigured(id)) });
    }
    return out;
  }
}
