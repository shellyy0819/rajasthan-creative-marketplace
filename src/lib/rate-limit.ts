/** Sliding-window limiter kept in memory (per process). Fine for one container; use a shared store if you scale out. */
export function createLimiter(max: number, windowMs: number, maxKeys = 10_000) {
  const hits = new Map<string, number[]>();
  return {
    hit(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
      const allowed = recent.length < max;
      if (allowed) recent.push(now);
      hits.delete(key); hits.set(key, recent);          // keep insertion order = recency
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value as string);
      return allowed;
    },
    size: () => hits.size,
  };
}
