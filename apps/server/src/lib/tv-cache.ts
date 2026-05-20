import { db, tv } from "@still/db";
import { eq } from "drizzle-orm";

import { tmdbApi } from "./tmdb";

/**
 * Ensures a `tv` row exists before we attach diary / watchlist FKs — mirrors
 * `ensureMovieCached` on the film path so TMDb stays the source of truth.
 */
export async function ensureTvCached(tmdbId: number) {
	const [exists] = await db
		.select({ id: tv.tmdbId })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbId))
		.limit(1);
	if (exists) return;
	try {
		const detail = await tmdbApi.tvDetail(tmdbId);
		const firstAir = detail.first_air_date ?? null;
		await db
			.insert(tv)
			.values({
				tmdbId: detail.id,
				title: detail.name,
				originalTitle: detail.original_name ?? null,
				overview: detail.overview ?? null,
				posterPath: detail.poster_path,
				backdropPath: detail.backdrop_path,
				firstAirDate: firstAir ? new Date(firstAir) : null,
				year: firstAir ? Number(firstAir.slice(0, 4)) : null,
				genreIds: (detail.genres ?? []).map((g) => g.id),
				originalLanguage: detail.original_language ?? null,
				popularity: detail.popularity ?? null,
				voteAverage: detail.vote_average ?? null,
				voteCount: detail.vote_count ?? null,
				status: detail.status ?? null,
				tmdbJson: detail as unknown as Record<string, unknown>,
				lastSyncedAt: new Date(),
			})
			.onConflictDoNothing();
	} catch (err) {
		console.error("[tv-cache] failed to cache series from TMDb", err);
	}
}
