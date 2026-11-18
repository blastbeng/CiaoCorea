/**
 * Limitatore in memoria. Non sopravvive al riavvio e non è condiviso fra
 * processi: per un'app con un container e pochi studenti è il compromesso
 * giusto, e comunque il costo di un tentativo di login (scrypt) è già alto.
 */
export interface RateLimiter {
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
  reset(key?: string): void;
}

export function createRateLimiter(
  limit: number,
  windowMs: number,
  clock: () => number = Date.now,
): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  return {
    hit(key) {
      const now = clock();
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      bucket.count += 1;
      if (bucket.count > limit) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }
      return { allowed: true, retryAfterSeconds: 0 };
    },

    reset(key) {
      if (key === undefined) buckets.clear();
      else buckets.delete(key);
    },
  };
}
