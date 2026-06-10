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
	// Select only overlap fields — full `movie`/`tv` rows include large `tmdb_json`
	// blobs and can exceed Neon's 64MB HTTP response cap at the 500-log limit.
	const rows = await db
		.select({
			movieId: log.movieId,
			tvId: log.tvId,
			rating: log.rating,
			watchedAt: log.watchedAt,
			movieTitle: movie.title,
			moviePosterPath: movie.posterPath,
			tvTitle: tv.title,
			tvPosterPath: tv.posterPath,
		})
		.from(log)
		.leftJoin(movie, eq(log.movieId, movie.tmdbId))
		.leftJoin(tv, eq(log.tvId, tv.tmdbId))
		.where(and(eq(log.userId, userId), isNull(log.removedAt)))
		.orderBy(desc(log.watchedAt))
		.limit(OVERLAP_DIARY_LIMIT);

	const slices: OverlapDiarySlice[] = [];
	for (const row of rows) {
		const key = logMediaKey(row.movieId, row.tvId);
		if (!key) continue;
		const isMovie = row.movieId != null;
		slices.push({
			key,
			mediaKind: isMovie ? "movie" : "tv",
			movieId: row.movieId,
			tvId: row.tvId,
			title: row.movieTitle ?? row.tvTitle ?? "Untitled",
			posterPath: row.moviePosterPath ?? row.tvPosterPath ?? null,
			rating: row.rating,
			watchedAtMs: row.watchedAt.getTime(),
		});
	}
	return slices;
}
