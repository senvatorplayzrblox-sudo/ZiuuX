export type BreakerState = 'closed' | 'open' | 'half_open';

export interface BreakerOptions {
  failureThreshold: number;
  cooldownMs: number;
  now?: () => number;
}

/**
 * closed -> (N consecutive failures) -> open -> (cooldown) -> half_open -> success: closed / failure: open.
 * Half-open admits exactly one probe at a time.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private probing = false;
  private current: BreakerState = 'closed';
  private readonly now: () => number;

  constructor(private readonly opts: BreakerOptions) {
    this.now = opts.now ?? Date.now;
  }

  get state(): BreakerState {
    if (this.current === 'open' && this.now() - this.openedAt >= this.opts.cooldownMs) this.current = 'half_open';
    return this.current;
  }

  get consecutiveFailures(): number {
    return this.failures;
  }

  /** Call before a request. true = may proceed. In half-open, reserves the single probe slot. */
  tryAcquire(): boolean {
    const s = this.state;
    if (s === 'closed') return true;
    if (s === 'open') return false;
    if (this.probing) return false;
    this.probing = true;
    return true;
  }

  onSuccess(): void {
    this.failures = 0;
    this.probing = false;
    this.current = 'closed';
  }

  onFailure(): void {
    this.probing = false;
    this.failures += 1;
    if (this.current === 'half_open' || this.failures >= this.opts.failureThreshold) {
      this.current = 'open';
      this.openedAt = this.now();
    }
  }

  /** Release a reserved probe slot without counting a result (e.g. request never sent). */
  release(): void {
    this.probing = false;
  }
}
