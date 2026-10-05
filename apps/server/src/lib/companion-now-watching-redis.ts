import {
	type CompanionMatchCandidate,
	CompanionNowWatching,
	type CompanionWatchingStore,
	MemoryCompanionWatchingStore,
} from "./companion-now-watching";
import { type CacheRedis, cacheRedis } from "./redis-cache";
import { tmdbApi } from "./tmdb";

function asStoredString(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "string") return value;
	return JSON.stringify(value);
}

/** Upstash when configured, otherwise one in-process store for local dev. */
export function companionWatchingStore(
	redis: CacheRedis | null,
	memory: MemoryCompanionWatchingStore,
): CompanionWatchingStore {
	if (!redis) return memory;
	return {
		async get(key) {
			try {
				return asStoredString(await redis.get(key));
			} catch {
				return memory.get(key, Date.now());
			}
		},
		async set(key, value, expiresAt) {
			const ttlSec = Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
			try {
				await redis.set(key, value, { ex: ttlSec });
			} catch {
				await memory.set(key, value, expiresAt);
			}
		},
		async del(key) {
			try {
				await redis.del(key);
			} catch {
				await memory.del(key);
			}
		},
	};
}

export async function searchCompanionTitles(input: {
	kind: "movie" | "episode";
	title: string;
}): Promise<CompanionMatchCandidate[]> {
	try {
		switch (input.kind) {
			case "movie": {
				const page = await tmdbApi.searchMovies(input.title);
				return page.results.map((row) => ({
					id: row.id,
					title: row.title,
					posterPath: row.poster_path,
				}));
			}
			case "episode": {
				const page = await tmdbApi.searchTv(input.title);
				return page.results.map((row) => ({
					id: row.id,
					title: row.name,
					posterPath: row.poster_path,
				}));
			}
			default: {
				const neverKind: never = input.kind;
				return neverKind;
			}
		}
	} catch {
		return [];
	}
}

const devMemory = new MemoryCompanionWatchingStore();

/** Production watcher. Heartbeats never write Neon. */
export function createCompanionNowWatching(): CompanionNowWatching {
	return new CompanionNowWatching(
		{
			async get(key, now) {
				const redis = await cacheRedis();
				return companionWatchingStore(redis, devMemory).get(key, now);
			},
			async set(key, value, expiresAt) {
				const redis = await cacheRedis();
				return companionWatchingStore(redis, devMemory).set(
					key,
					value,
					expiresAt,
				);
			},
			async del(key) {
				const redis = await cacheRedis();
				return companionWatchingStore(redis, devMemory).del(key);
			},
		},
		searchCompanionTitles,
	);
}
