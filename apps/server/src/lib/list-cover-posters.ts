import { db, movie } from "@still/db";
import { inArray } from "drizzle-orm";

/**
 * Joins `movie.poster_path` for each id in `list.cover_movie_ids` (order preserved).
 * Used by list list endpoints so UIs can paint Savee-style strips without N+1 queries.
 */
export async function withCoverPosterPaths<
	L extends { coverMovieIds: number[] },
>(rows: L[]): Promise<(L & { coverPosterPaths: (string | null)[] })[]> {
	const unique = new Set<number>();
	for (const r of rows) {
		for (const id of r.coverMovieIds) unique.add(id);
	}
	const ids = [...unique];
	if (ids.length === 0) {
		return rows.map((r) => ({
			...r,
			coverPosterPaths: r.coverMovieIds.map(() => null),
		}));
	}
	const hits = await db
		.select({ tmdbId: movie.tmdbId, posterPath: movie.posterPath })
		.from(movie)
		.where(inArray(movie.tmdbId, ids));
	const map = new Map(hits.map((h) => [h.tmdbId, h.posterPath]));
	return rows.map((r) => ({
		...r,
		coverPosterPaths: r.coverMovieIds.map((id) => map.get(id) ?? null),
	}));
}
