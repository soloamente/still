import { db, log } from "@still/db";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";

import { logMediaKey } from "./sense-taste-overlap";
import { resolveTvTitleScore } from "./tv-title-score";

export type OwnerLogScore = {
	rating: number | null;
	liked: boolean;
};

export type OwnerLogScoreRow = {
	movieId: number | null;
	tvId: number | null;
	rating: number | null;
	liked: boolean;
	watchedAt: Date | string;
	logScope?: string | null;
	seasonNumber?: number | null;
};

/**
 * Build owner score map from diary rows ordered newest-first.
 * Movies: latest row wins. TV: resolveTvTitleScore across scopes; liked if any heart.
 */
export function buildOwnerLogScoresFromRows(
	rows: OwnerLogScoreRow[],
): Map<string, OwnerLogScore> {
	const movieLatest = new Map<string, OwnerLogScore>();
	const tvBuckets = new Map<
		string,
		{
			logs: {
				logScope?: string | null;
				seasonNumber?: number | null;
				rating: number | null;
			}[];
			liked: boolean;
		}
	>();

	for (const row of rows) {
		const key = logMediaKey(row.movieId, row.tvId);
		if (!key) continue;

		if (row.tvId != null) {
			const bucket = tvBuckets.get(key);
			if (bucket) {
				bucket.logs.push({
					logScope: row.logScope,
					seasonNumber: row.seasonNumber,
					rating: row.rating,
				});
				if (row.liked) bucket.liked = true;
			} else {
				tvBuckets.set(key, {
					logs: [
						{
							logScope: row.logScope,
							seasonNumber: row.seasonNumber,
							rating: row.rating,
						},
					],
					liked: row.liked,
				});
			}
			continue;
		}

		if (movieLatest.has(key)) continue;
		movieLatest.set(key, {
			rating: row.rating,
			liked: row.liked,
		});
	}

	const scores = new Map<string, OwnerLogScore>(movieLatest);
	for (const [key, bucket] of tvBuckets) {
		scores.set(key, {
			rating: resolveTvTitleScore(bucket.logs),
			liked: bucket.liked,
		});
	}
	return scores;
}

/**
 * Diary scores for list detail posters — TV uses derived title scores.
 */
export async function fetchOwnerLogScoresForListItems(
	ownerUserId: string,
	items: { movieId: number | null; tvId: number | null }[],
): Promise<Map<string, OwnerLogScore>> {
	const movieIds = [
		...new Set(
			items
				.map((row) => row.movieId)
				.filter((id): id is number => typeof id === "number" && id > 0),
		),
	];
	const tvIds = [
		...new Set(
			items
				.map((row) => row.tvId)
				.filter((id): id is number => typeof id === "number" && id > 0),
		),
	];

	if (movieIds.length === 0 && tvIds.length === 0) {
		return new Map();
	}

	const mediaFilter =
		movieIds.length > 0 && tvIds.length > 0
			? or(inArray(log.movieId, movieIds), inArray(log.tvId, tvIds))
			: movieIds.length > 0
				? inArray(log.movieId, movieIds)
				: inArray(log.tvId, tvIds);

	const rows = await db
		.select({
			movieId: log.movieId,
			tvId: log.tvId,
			rating: log.rating,
			liked: log.liked,
			watchedAt: log.watchedAt,
			logScope: log.logScope,
			seasonNumber: log.seasonNumber,
		})
		.from(log)
		.where(and(eq(log.userId, ownerUserId), isNull(log.removedAt), mediaFilter))
		.orderBy(desc(log.watchedAt));

	return buildOwnerLogScoresFromRows(rows);
}
