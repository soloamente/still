import { db, log } from "@still/db";
import { and, desc, eq, inArray, or } from "drizzle-orm";

import { logMediaKey } from "./sense-taste-overlap";

export type OwnerLogScore = {
	rating: number | null;
	liked: boolean;
};

/**
 * Latest diary row per title for a patron — used to show owner scores on list detail.
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
		})
		.from(log)
		.where(and(eq(log.userId, ownerUserId), mediaFilter))
		.orderBy(desc(log.watchedAt));

	const scores = new Map<string, OwnerLogScore>();
	for (const row of rows) {
		const key = logMediaKey(row.movieId, row.tvId);
		if (!key || scores.has(key)) continue;
		scores.set(key, {
			rating: row.rating,
			liked: row.liked,
		});
	}
	return scores;
}
