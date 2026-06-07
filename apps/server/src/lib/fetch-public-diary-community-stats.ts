import { db, log } from "@still/db";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { reviewRatingDisplayAvgSql } from "./review-rating";

export type PublicDiaryCommunityStats = {
	averageRating: number | null;
	ratingsCount: number;
};

/** Coerce SQL aggregate row into API `community` shape. */
export function coercePublicDiaryCommunityStats(row: {
	avgRating: unknown;
	ratingsCount: unknown;
}): PublicDiaryCommunityStats {
	const ratingsCount = Number(row.ratingsCount ?? 0) || 0;
	const averageRating =
		ratingsCount > 0 &&
		row.avgRating != null &&
		Number.isFinite(Number(row.avgRating))
			? Number(row.avgRating)
			: null;
	return { averageRating, ratingsCount };
}

/**
 * Public patron community score from diary logs — one current rating per patron
 * (latest public log row per user). TV uses series-level logs only (`logScope = show`).
 */
export async function fetchPublicDiaryCommunityStats(
	input: { movieId: number } | { tvId: number },
): Promise<PublicDiaryCommunityStats> {
	const isTv = "tvId" in input;

	const baseWhere = and(
		isTv ? eq(log.tvId, input.tvId) : eq(log.movieId, input.movieId),
		eq(log.visibility, "public"),
		isNull(log.removedAt),
		isNotNull(log.rating),
		...(isTv ? [eq(log.logScope, "show")] : []),
	);

	// One score per patron — rewatch edits the same row; DISTINCT ON guards anomalies.
	const patronScores = db
		.selectDistinctOn([log.userId], {
			userId: log.userId,
			rating: log.rating,
		})
		.from(log)
		.where(baseWhere)
		.orderBy(log.userId, desc(log.updatedAt), desc(log.id))
		.as("patron_scores");

	const [row] = await db
		.select({
			avgRating:
				sql<number>`${sql.raw(reviewRatingDisplayAvgSql("patron_scores.rating"))}`.as(
					"avgRating",
				),
			ratingsCount: sql<number>`count(*)::int`.as("ratingsCount"),
		})
		.from(patronScores);

	return coercePublicDiaryCommunityStats(
		row ?? { avgRating: null, ratingsCount: 0 },
	);
}
