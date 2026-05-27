interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface TtlCache<T> {
  /** Returns the value only if not expired, otherwise undefined. */
  get(key: string): T | undefined;
  /** Returns the value even if TTL has expired (stale-if-error). */
  getStale(key: string): T | undefined;
  set(key: string, value: T, ttlMs: number): void;
  invalidate(key: string): void;
}

export function createTtlCache<T>(): TtlCache<T> {
  const store = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | undefined {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() > entry.expiresAt) return undefined;
      return entry.value;
    },

    getStale(key: string): T | undefined {
      return store.get(key)?.value;
    },

    set(key: string, value: T, ttlMs: number): void {
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
    },

    invalidate(key: string): void {
      store.delete(key);
    },
  };
}
