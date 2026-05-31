import { db, movie } from "@still/db";
import { eq } from "drizzle-orm";

import { tmdbApi } from "./tmdb";

/** Ensures a TMDb film row exists locally before diary FK insert. */
export async function ensureMovieCached(tmdbId: number) {
	const [exists] = await db
		.select({ id: movie.tmdbId })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);
	if (exists) return;
	try {
		const detail = await tmdbApi.movieDetail(tmdbId);
		const releaseDate = detail.release_date ?? null;
		await db
			.insert(movie)
			.values({
				tmdbId: detail.id,
				title: detail.title,
				overview: detail.overview,
				posterPath: detail.poster_path,
				backdropPath: detail.backdrop_path,
				releaseDate: releaseDate ? new Date(releaseDate) : null,
				year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
				runtime: detail.runtime ?? null,
				genreIds: (detail.genres ?? []).map((g) => g.id),
				spokenLanguages: (detail.spoken_languages ?? []).map(
					(l) => l.iso_639_1,
				),
				originalLanguage: detail.original_language ?? null,
				popularity: detail.popularity ?? null,
				voteAverage: detail.vote_average ?? null,
				voteCount: detail.vote_count ?? null,
				tmdbJson: detail as unknown as Record<string, unknown>,
				lastSyncedAt: new Date(),
			})
			.onConflictDoNothing();
	} catch (err) {
		console.error("[ensureMovieCached] TMDb detail failed", err);
	}
}
