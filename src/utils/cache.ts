/**
 * Small TTL cache behind an interface so a shared implementation (Redis / shard broadcast)
 * can replace it when sharding is enabled. Caches are disposable: MongoDB is the source of truth.
 */
export interface CacheStore<V> {
  get(key: string): V | undefined;
  set(key: string, value: V, ttlMs?: number): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export class TtlCache<V> implements CacheStore<V> {
  private readonly map = new Map<string, { value: V; expires: number }>();

  constructor(
    private readonly defaultTtlMs: number,
    private readonly maxEntries = 5000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: V, ttlMs = this.defaultTtlMs): void {
    if (this.map.size >= this.maxEntries && !this.map.has(key)) this.evict();
    this.map.set(key, { value, expires: this.now() + ttlMs });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  private evict(): void {
    const t = this.now();
    for (const [k, v] of this.map) if (v.expires <= t) this.map.delete(k);
    if (this.map.size >= this.maxEntries) {
      const first = this.map.keys().next();
      if (!first.done) this.map.delete(first.value);
    }
  }
}
