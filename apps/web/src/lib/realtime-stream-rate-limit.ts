/**
 * In-memory rate limit for SSE stream connects (single Next.js process).
 * Swap for Upstash when web scales horizontally.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Returns true when the patron may open or refresh an SSE connection. */
export function hitRealtimeStreamRateLimit(
	userId: string,
	opts: { limit: number; windowMs: number } = {
		limit: process.env.NODE_ENV === "development" ? 120 : 10,
		windowMs: 60_000,
	},
): boolean {
	const key = `realtime-stream:${userId}`;
	const now = Date.now();
	const bucket = buckets.get(key);

	if (!bucket || bucket.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
		return true;
	}

	bucket.count += 1;
	return bucket.count <= opts.limit;
}
