import { db, movie } from "@still/db";
import { inArray } from "drizzle-orm";

import { listDisplayCoverMovieIds } from "./list-display-cover";

/**
 * Joins `movie.poster_path` for list cover ids (pinned `coverMovieId` first when set).
 * Used by list list endpoints so UIs can paint Savee-style strips without N+1 queries.
 */
export async function withCoverPosterPaths<
	L extends { coverMovieIds: number[]; coverMovieId?: number | null },
>(rows: L[]): Promise<(L & { coverPosterPaths: (string | null)[] })[]> {
	const unique = new Set<number>();
	for (const r of rows) {
		for (const id of listDisplayCoverMovieIds(r)) unique.add(id);
	}
	const ids = [...unique];
	if (ids.length === 0) {
		return rows.map((r) => ({
			...r,
			coverPosterPaths: listDisplayCoverMovieIds(r).map(() => null),
		}));
	}
	const hits = await db
		.select({ tmdbId: movie.tmdbId, posterPath: movie.posterPath })
		.from(movie)
		.where(inArray(movie.tmdbId, ids));
	const map = new Map(hits.map((h) => [h.tmdbId, h.posterPath]));
	return rows.map((r) => {
		const displayIds = listDisplayCoverMovieIds(r);
		return {
			...r,
			coverPosterPaths: displayIds.map((id) => map.get(id) ?? null),
		};
	});
}
