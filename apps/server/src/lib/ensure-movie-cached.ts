import { db, movie } from "@still/db";
import { eq } from "drizzle-orm";

import { tmdbApi } from "./tmdb";

/** Ensures a `movie` row exists before diary / watchlist FKs attach. */
export async function ensureMovieCached(tmdbId: number) {
	const [exists] = await db
		.select({ id: movie.tmdbId })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);
	if (exists) return;
	try {
		const detail = await tmdbApi.movieDetail(tmdbId);
		await db
			.insert(movie)
			.values({
				tmdbId: detail.id,
				title: detail.title,
				overview: detail.overview,
				posterPath: detail.poster_path,
				backdropPath: detail.backdrop_path,
				releaseDate: detail.release_date ? new Date(detail.release_date) : null,
				year: detail.release_date
					? Number(detail.release_date.slice(0, 4))
					: null,
				runtime: detail.runtime ?? null,
				tmdbJson: detail as unknown as Record<string, unknown>,
				lastSyncedAt: new Date(),
			})
			.onConflictDoNothing();
	} catch {
		// TMDb miss — caller may still fail on FK; avoids crashing the request path.
	}
}
