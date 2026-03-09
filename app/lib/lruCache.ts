/**
 * Simple in-memory LRU cache (insertion-order eviction via Map).
 * Thread-safe for single-process Node.js usage.
 */
export function createLRUCache<V>(maxSize: number, ttlMs: number) {
  const cache = new Map<string, { value: V; expiresAt: number }>();

  function get(key: string): V | undefined {
    const entry = cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      cache.delete(key);
      return undefined;
    }
    // Refresh position (LRU: move to end)
    cache.delete(key);
    cache.set(key, entry);
    return entry.value;
  }

  function set(key: string, value: V): void {
    if (cache.size >= maxSize) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  function size(): number {
    return cache.size;
  }

  return { get, set, size };
}
