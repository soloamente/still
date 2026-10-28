import { hit } from "./rate-limit";

/**
 * Per-patron spend limits for the metered translation model.
 *
 * Charged only when a model call is actually about to happen — cache hits and
 * stored rows are free, so a reader flipping through already-translated reviews
 * never burns their allowance.
 *
 * The counters live in Redis because the in-memory limiter is per process: on
 * an isolate-per-request host each isolate would start from zero and the daily
 * ceiling would never bind. Without Redis (local dev) it falls back to that
 * in-memory limiter, which is fine for a single process.
 */

/** The slice of Upstash this needs. Typed here so `CacheRedis` stays untouched. */
export type QuotaRedis = {
	incr: (key: string) => Promise<number>;
	expire: (key: string, seconds: number) => Promise<unknown>;
};

export type TranslationQuotaReason = "burst" | "daily";

export type TranslationQuotaWindow = {
	/** Stable id used in the key and the in-memory fallback. */
	name: string;
	limit: number;
	windowMs: number;
	/** Error reason surfaced to the route for the 429 body. */
	reason: TranslationQuotaReason;
};

/** One runaway client must not spend the month's budget in an afternoon. */
export const TRANSLATION_QUOTA_WINDOWS: readonly TranslationQuotaWindow[] = [
	{ name: "burst", limit: 20, windowMs: 60_000, reason: "burst" },
	{ name: "day", limit: 200, windowMs: 86_400_000, reason: "daily" },
];

export class TranslationQuotaError extends Error {
	readonly reason: TranslationQuotaReason;

	constructor(reason: TranslationQuotaReason) {
		super(
			reason === "daily"
				? "Daily translation limit reached"
				: "Translation requests too frequent",
		);
		this.name = "TranslationQuotaError";
		this.reason = reason;
	}
}

/**
 * Fixed-window counter: the key carries the window index, so even if the EXPIRE
 * after the first INCR were lost the next window starts on a fresh key.
 */
async function spendRedisWindow(
	redis: QuotaRedis,
	userId: string,
	window: TranslationQuotaWindow,
	now: number,
): Promise<boolean> {
	const bucket = Math.floor(now / window.windowMs);
	const key = `sense:quota:review-translate:${window.name}:${userId}:${bucket}`;
	const count = await redis.incr(key);
	if (count === 1) {
		// Outlive the window slightly so a request at the boundary still sees it.
		await redis.expire(key, Math.ceil(window.windowMs / 1000) + 5);
	}
	return count <= window.limit;
}

function spendMemoryWindow(
	userId: string,
	window: TranslationQuotaWindow,
): boolean {
	return hit(`reviews:translate:${window.name}:${userId}`, {
		limit: window.limit,
		windowMs: window.windowMs,
	}).ok;
}

/**
 * Spend one translation. Throws {@link TranslationQuotaError} when a window is
 * exhausted. Redis failures fall back to the in-memory limiter — a cache outage
 * should degrade the cap, not take translation down.
 */
export async function spendTranslationQuota(
	redis: QuotaRedis | null,
	userId: string,
	options: {
		now?: number;
		windows?: readonly TranslationQuotaWindow[];
	} = {},
): Promise<void> {
	const now = options.now ?? Date.now();
	const windows = options.windows ?? TRANSLATION_QUOTA_WINDOWS;

	for (const window of windows) {
		let allowed: boolean;
		if (redis) {
			try {
				allowed = await spendRedisWindow(redis, userId, window, now);
			} catch (error) {
				console.error("[review-translation-quota] redis failed", error);
				allowed = spendMemoryWindow(userId, window);
			}
		} else {
			allowed = spendMemoryWindow(userId, window);
		}
		if (!allowed) throw new TranslationQuotaError(window.reason);
	}
}
