/**
 * Process-level TTL cache with in-flight de-duplication. Facet runs as a single
 * Node process on the VPS, so this keeps us well inside free API rate limits:
 * 100 users looking at AAPL cost one upstream call per TTL window.
 */
type Entry = { value: unknown; expires: number };
const g = globalThis as unknown as { __facetCache?: Map<string, Entry>; __facetInflight?: Map<string, Promise<unknown>> };
const store = (g.__facetCache ??= new Map());
const inflight = (g.__facetInflight ??= new Map());

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      if (store.size > 5000) {
        // crude eviction: drop the oldest quarter
        [...store.keys()].slice(0, 1250).forEach((k) => store.delete(k));
      }
      return value;
    })
    .catch((e) => {
      // serve stale data if we have it rather than failing the page
      if (hit) return hit.value as T;
      throw e;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Peek without loading (used to reuse fresh quotes in batch lookups). */
export function peek<T>(key: string): T | undefined {
  const hit = store.get(key);
  return hit && hit.expires > Date.now() ? (hit.value as T) : undefined;
}
