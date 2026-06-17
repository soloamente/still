/** Minimal Upstash surface used for read-through caching. */
export type CacheRedis = {
	get: <T>(key: string) => Promise<T | null>;
	set: (
		key: string,
		value: unknown,
		opts?: { ex?: number },
	) => Promise<unknown>;
	del: (...keys: string[]) => Promise<unknown>;
};

/**
 * Shared Upstash client typed for caching; null in local dev without Upstash env.
 * Uses a lazy dynamic import so the env module is not evaluated at import time
 * (allows unit tests to pass a fake redis without mocking env vars).
 */
export async function cacheRedis(): Promise<CacheRedis | null> {
	const { getRealtimeRedis } = await import("./realtime-redis");
	return getRealtimeRedis() as unknown as CacheRedis | null;
}

/**
 * Read-through cache. On hit returns the cached value; on miss runs `loader`,
 * stores the result with a TTL, and returns it. Cache errors never fail the
 * caller — they fall through to `loader`.
 */
export async function cachedRead<T>(
	redis: CacheRedis | null,
	key: string,
	ttlSec: number,
	loader: () => Promise<T>,
): Promise<T> {
	if (!redis) return loader();
	try {
		const cached = await redis.get<T>(key);
		if (cached !== null && cached !== undefined) return cached;
	} catch {
		// Cache read failed — fall through to the source of truth.
	}
	const value = await loader();
	try {
		await redis.set(key, value, { ex: ttlSec });
	} catch {
		// Best-effort cache write.
	}
	return value;
}

/** Delete cache keys; best-effort, no-op without a client. */
export async function invalidateCache(
	redis: CacheRedis | null,
	...keys: string[]
): Promise<void> {
	if (!redis || keys.length === 0) return;
	try {
		await redis.del(...keys);
	} catch {
		// Best-effort invalidation.
	}
}
