/**
 * Naive in-memory rate limiter. Good enough for a single-region Bun
 * process; swap out for Upstash Ratelimit when we deploy horizontally.
 *
 * Usage:
 *   if (!hit(`mut:${userId}`, { limit: 30, windowMs: 60_000 })) {
 *     throw new Error("RATE_LIMITED");
 *   }
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function hit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(key, fresh);
    return { ok: true, remaining: opts.limit - 1, resetAt: fresh.resetAt };
  }
  bucket.count += 1;
  const ok = bucket.count <= opts.limit;
  return { ok, remaining: Math.max(0, opts.limit - bucket.count), resetAt: bucket.resetAt };
}

// Periodically garbage-collect expired buckets so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60_000).unref?.();
