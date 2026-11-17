import { AI_LIMITS } from '../config/constants.js';
import type { CircuitBreaker, BreakerState } from './circuitBreaker.js';
import type { FailureReason } from './types.js';

export type ProviderState = 'not_configured' | 'healthy' | 'degraded';

export interface HealthSnapshot {
  state: ProviderState;
  breaker: BreakerState;
  consecutiveFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  successes: number;
  failures: number;
  recentFailureRatio: number;
}

/** Rolling-window health for one provider. Pure apart from the injected breaker/clock. */
export class ProviderHealth {
  private window: boolean[] = [];
  private lastSuccessAt: number | null = null;
  private lastFailureAt: number | null = null;
  private lastError: string | null = null;
  private successes = 0;
  private failures = 0;
  dirty = false;

  constructor(
    readonly breaker: CircuitBreaker,
    private readonly now: () => number = Date.now,
  ) {}

  recordSuccess(): void {
    this.push(true);
    this.successes += 1;
    this.lastSuccessAt = this.now();
    this.breaker.onSuccess();
    this.dirty = true;
  }

  recordFailure(reason: FailureReason, detail?: string): void {
    this.push(false);
    this.failures += 1;
    this.lastFailureAt = this.now();
    this.lastError = detail ? `${reason}: ${detail}` : reason;
    this.breaker.onFailure();
    this.dirty = true;
  }

  private push(ok: boolean): void {
    this.window.push(ok);
    if (this.window.length > AI_LIMITS.healthWindow) this.window.shift();
  }

  snapshot(configured: boolean): HealthSnapshot {
    const failedInWindow = this.window.filter((x) => !x).length;
    const ratio = this.window.length ? failedInWindow / this.window.length : 0;
    const breaker = this.breaker.state;
    let state: ProviderState = 'healthy';
    if (!configured) state = 'not_configured';
    else if (breaker !== 'closed' || (this.window.length >= AI_LIMITS.healthMinSamples && ratio >= AI_LIMITS.healthDegradedRatio)) state = 'degraded';
    return {
      state,
      breaker,
      consecutiveFailures: this.breaker.consecutiveFailures,
      lastSuccessAt: this.lastSuccessAt,
      lastFailureAt: this.lastFailureAt,
      lastError: this.lastError,
      successes: this.successes,
      failures: this.failures,
      recentFailureRatio: ratio,
    };
  }
}
