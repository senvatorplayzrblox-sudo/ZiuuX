export interface QueueOptions {
  concurrency: number;
  maxSize: number;
  onError?: (err: unknown) => void;
}

/** Bounded FIFO with a concurrency cap. A full queue REJECTS (caller fails open) instead of growing. */
export class BoundedTaskQueue {
  private readonly pending: Array<() => Promise<void>> = [];
  private running = 0;
  private closed = false;
  private idleResolvers: Array<() => void> = [];

  constructor(private readonly opts: QueueOptions) {}

  get size(): number {
    return this.pending.length;
  }
  get active(): number {
    return this.running;
  }

  /** false = rejected (queue full or shutting down). */
  enqueue(task: () => Promise<void>): boolean {
    if (this.closed || this.pending.length >= this.opts.maxSize) return false;
    this.pending.push(task);
    this.pump();
    return true;
  }

  private pump(): void {
    while (this.running < this.opts.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.running += 1;
      task()
        .catch((err) => this.opts.onError?.(err))
        .finally(() => {
          this.running -= 1;
          this.pump();
          this.notifyIdle();
        });
    }
  }

  private notifyIdle(): void {
    if (this.running === 0 && this.pending.length === 0) {
      const rs = this.idleResolvers;
      this.idleResolvers = [];
      for (const r of rs) r();
    }
  }

  /** Stop accepting work and wait (bounded) for in-flight tasks. Remaining queued tasks are dropped. */
  async drain(timeoutMs: number): Promise<void> {
    this.closed = true;
    this.pending.length = 0;
    if (this.running === 0) return;
    await Promise.race([new Promise<void>((r) => this.idleResolvers.push(r)), new Promise<void>((r) => setTimeout(r, timeoutMs).unref?.())]);
  }
}
