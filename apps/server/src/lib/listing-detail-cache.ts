import { getRealtimeRedis } from "./realtime-redis";

const MOVIE_TTL_SECONDS = 3600; // 1 hour — movie metadata rarely changes between TMDB syncs
const TV_TTL_SECONDS = 3600;

function movieDetailKey(id: number, language: string): string {
	return `sense:detail:movie:${id}:${language}`;
}

function tvDetailKey(id: number, language: string): string {
	return `sense:detail:tv:${id}:${language}`;
}

export async function getCachedMovieDetail<T>(
	id: number,
	language: string,
): Promise<T | null> {
	const redis = getRealtimeRedis();
	if (!redis) return null;
	try {
		return await redis.get<T>(movieDetailKey(id, language));
	} catch {
		return null;
	}
}

export async function setCachedMovieDetail<T>(
	id: number,
	language: string,
	value: T,
): Promise<void> {
	const redis = getRealtimeRedis();
	if (!redis) return;
	try {
		await redis.set(movieDetailKey(id, language), value, {
			ex: MOVIE_TTL_SECONDS,
		});
	} catch {
		// best-effort
	}
}

export async function invalidateMovieDetailCache(id: number): Promise<void> {
	const redis = getRealtimeRedis();
	if (!redis) return;
	try {
		// Bust en-US (the most common) and a wildcard pattern isn't supported by
		// Upstash REST API, so we bust the default language key. Non-default
		// language caches expire naturally via TTL.
		await redis.del(movieDetailKey(id, "en-US"));
	} catch {
		// best-effort
	}
}

export async function getCachedTvDetail<T>(
	id: number,
	language: string,
): Promise<T | null> {
	const redis = getRealtimeRedis();
	if (!redis) return null;
	try {
		return await redis.get<T>(tvDetailKey(id, language));
	} catch {
		return null;
	}
}

export async function setCachedTvDetail<T>(
	id: number,
	language: string,
	value: T,
): Promise<void> {
	const redis = getRealtimeRedis();
	if (!redis) return;
	try {
		await redis.set(tvDetailKey(id, language), value, { ex: TV_TTL_SECONDS });
	} catch {
		// best-effort
	}
}

export async function invalidateTvDetailCache(id: number): Promise<void> {
	const redis = getRealtimeRedis();
	if (!redis) return;
	try {
		await redis.del(tvDetailKey(id, "en-US"));
	} catch {
		// best-effort
	}
}
