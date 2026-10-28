/**
 * Single-flight for an expensive, cacheable computation.
 *
 * Without it, N readers opening the same untranslated review at once each pay
 * for a model call, and each can be handed a different wording. Here the first
 * caller takes a short Redis lock and does the work; everyone else polls the
 * result key and returns what the leader produced.
 *
 * Best-effort by design: a failed lock call, a dead leader, or a slow model all
 * degrade to "just do the work yourself" — never to a stuck or failed request.
 */

/** The slice of Upstash this needs. */
export type SingleFlightRedis = {
	get: <T>(key: string) => Promise<T | null>;
	set: (
		key: string,
		value: unknown,
		opts?: { ex?: number; nx?: boolean },
	) => Promise<unknown>;
	del: (...keys: string[]) => Promise<unknown>;
};

export type SingleFlightOptions<T> = {
	redis: SingleFlightRedis | null;
	/** Lock key — one holder at a time. */
	lockKey: string;
	/** Where the leader's result lands (the read-through cache key). */
	resultKey: string;
	/** Lock lifetime; must outlast a normal model call. */
	lockTtlSec: number;
	/** How long a follower waits for the leader before doing the work itself. */
	waitMs: number;
	pollMs: number;
	run: () => Promise<T>;
	/** Injectable so tests need not really wait. */
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
};

const defaultSleep = (ms: number) =>
	new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function singleFlight<T>(
	options: SingleFlightOptions<T>,
): Promise<T> {
	const { redis, lockKey, resultKey, run } = options;
	if (!redis) return run();

	let acquired = false;
	try {
		// NX: only one caller gets "OK"; the rest get null.
		acquired =
			(await redis.set(lockKey, "1", {
				nx: true,
				ex: options.lockTtlSec,
			})) === "OK";
	} catch {
		// Lock store unreachable — do the work rather than block on it.
		return run();
	}

	if (acquired) {
		try {
			return await run();
		} finally {
			try {
				await redis.del(lockKey);
			} catch {
				// The TTL releases it anyway.
			}
		}
	}

	const sleep = options.sleep ?? defaultSleep;
	const now = options.now ?? Date.now;
	const deadline = now() + options.waitMs;
	while (now() < deadline) {
		await sleep(options.pollMs);
		try {
			const ready = await redis.get<T>(resultKey);
			if (ready !== null && ready !== undefined) return ready;
		} catch {
			// Keep polling until the deadline, then fall through.
		}
	}

	// Leader failed or is slow — a duplicate call beats a hung request.
	return run();
}
