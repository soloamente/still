import { db, movie, tv } from "@still/db";
import { env } from "@still/env/server";
import { eq } from "drizzle-orm";

import { tmdbApi } from "./tmdb";

const BACKFILL_CONCURRENCY = 5;
/** Cap TMDb lookups per filmography page so profile load stays bounded. */
export const BACKFILL_LISTING_POSTERS_MAX = 16;

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	if (items.length === 0) return [];
	const results: R[] = new Array(items.length);
	let nextIndex = 0;
	const workers = Array.from(
		{ length: Math.min(limit, items.length) },
		async () => {
			while (nextIndex < items.length) {
				const index = nextIndex;
				nextIndex += 1;
				results[index] = await fn(items[index] as T);
			}
		},
	);
	await Promise.all(workers);
	return results;
}

/**
 * Fetch missing poster paths from TMDb and persist them on `movie`/`tv` rows.
 * Used by profile filmography when cached artwork is absent but detail would sync it.
 */
export async function backfillMissingListingPosters(
	kind: "movie" | "tv",
	tmdbIds: number[],
): Promise<Map<number, string | null>> {
	const out = new Map<number, string | null>();
	if (!env.TMDB_API_KEY) return out;

	const unique = [...new Set(tmdbIds)].slice(0, BACKFILL_LISTING_POSTERS_MAX);
	if (unique.length === 0) return out;

	await mapWithConcurrency(unique, BACKFILL_CONCURRENCY, async (tmdbId) => {
		try {
			if (kind === "movie") {
				const detail = await tmdbApi.movieDetail(tmdbId);
				const path = detail.poster_path ?? null;
				if (path) {
					await db
						.update(movie)
						.set({ posterPath: path, lastSyncedAt: new Date() })
						.where(eq(movie.tmdbId, tmdbId));
				}
				out.set(tmdbId, path);
				return;
			}

			const detail = await tmdbApi.tvDetail(tmdbId);
			const path = detail.poster_path ?? null;
			if (path) {
				await db
					.update(tv)
					.set({ posterPath: path, lastSyncedAt: new Date() })
					.where(eq(tv.tmdbId, tmdbId));
			}
			out.set(tmdbId, path);
		} catch (err) {
			console.error("[backfill-listing-posters] TMDb lookup failed", {
				kind,
				tmdbId,
				err,
			});
			out.set(tmdbId, null);
		}
	});

	return out;
}
