import { db, movie } from "@still/db";
import { env } from "@still/env/server";
import { eq } from "drizzle-orm";

import { tmdbApi } from "./tmdb";
import {
	pickTrailerFromTmdbJson,
	pickTrailerFromVideoResults,
} from "./tmdb-trailer-pick";

/**
 * Resolve a background trailer for lobby heroes — cached `tmdbJson` first,
 * then a dedicated `/movie/{id}/videos` fetch when videos are missing.
 */
export async function resolveMovieTrailer(
	tmdbId: number,
): Promise<{ trailerKey: string; trailerSite: string } | null> {
	const [row] = await db
		.select({ tmdbJson: movie.tmdbJson })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);

	let trailer = pickTrailerFromTmdbJson(
		row?.tmdbJson as Record<string, unknown> | null | undefined,
	);

	if (!trailer && env.TMDB_API_KEY) {
		try {
			const videos = await tmdbApi.movieVideos(tmdbId);
			trailer = pickTrailerFromVideoResults(videos?.results);
		} catch {
			// Best-effort — hero falls back to the still backdrop.
		}
	}

	if (!trailer?.key) return null;
	return { trailerKey: trailer.key, trailerSite: trailer.site };
}
