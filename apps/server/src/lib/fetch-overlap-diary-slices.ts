import { db, log, movie, tv } from "@still/db";
import { and, desc, eq, isNull } from "drizzle-orm";

import { logMediaKey, type OverlapDiarySlice } from "./sense-taste-overlap";

const OVERLAP_DIARY_LIMIT = 500;

/**
 * Loads a patron's diary for taste overlap — same cap as profile filmography.
 */
export async function fetchOverlapDiarySlices(
	userId: string,
): Promise<OverlapDiarySlice[]> {
	const rows = await db
		.select({ log, movie, tv })
		.from(log)
		.leftJoin(movie, eq(log.movieId, movie.tmdbId))
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(and(eq(log.userId, userId), isNull(log.removedAt)))
		.orderBy(desc(log.watchedAt))
		.limit(OVERLAP_DIARY_LIMIT);

	const slices: OverlapDiarySlice[] = [];
	for (const row of rows) {
		const key = logMediaKey(row.log.movieId, row.log.tvId);
		if (!key) continue;
		const isMovie = row.log.movieId != null;
		slices.push({
			key,
			mediaKind: isMovie ? "movie" : "tv",
			movieId: row.log.movieId,
			tvId: row.log.tvId,
			title: row.movie?.title ?? row.tv?.title ?? "Untitled",
			posterPath: row.movie?.posterPath ?? row.tv?.posterPath ?? null,
			rating: row.log.rating,
			watchedAtMs: row.log.watchedAt.getTime(),
		});
	}
	return slices;
}
