import { db, movie } from "@still/db";
import { and, eq, ilike } from "drizzle-orm";

import { tmdbApi } from "./tmdb";

export type LetterboxdTmdbSearch = (
	query: string,
	page?: number,
) => Promise<{ results?: { id?: number; release_date?: string }[] }>;

/**
 * Resolve a Letterboxd film row to a TMDb movie id — DB title/year cache first,
 * then TMDb search fallback (same strategy as the original import route).
 */
export async function resolveLetterboxdMovieTmdbId(
	name: string,
	year: number | null,
	deps?: { searchMovies?: LetterboxdTmdbSearch },
): Promise<number | null> {
	if (year != null) {
		const [byYear] = await db
			.select({ tmdbId: movie.tmdbId })
			.from(movie)
			.where(and(ilike(movie.title, name), eq(movie.year, year)))
			.limit(1);
		if (byYear) return byYear.tmdbId;
	}
	const [byTitle] = await db
		.select({ tmdbId: movie.tmdbId })
		.from(movie)
		.where(ilike(movie.title, name))
		.limit(1);
	if (byTitle) return byTitle.tmdbId;

	const searchMovies = deps?.searchMovies ?? tmdbApi.searchMovies.bind(tmdbApi);
	try {
		const search = await searchMovies(name, 1);
		const candidates = search.results ?? [];
		const hit =
			year != null
				? candidates.find((c) => c.release_date?.startsWith(String(year)))
				: candidates[0];
		return hit?.id ?? null;
	} catch (err) {
		console.error("[letterboxd-tmdb-resolve] TMDb search failed", err);
		return null;
	}
}
