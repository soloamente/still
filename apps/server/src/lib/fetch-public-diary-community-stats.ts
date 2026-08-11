import { db, log } from "@still/db";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { reviewRatingDisplayAvgSql } from "./review-rating";
import { resolveTvTitleScore } from "./tv-title-score";

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

export type TvCommunityScoreRow = {
	userId: string;
	logScope: string | null;
	seasonNumber: number | null;
	rating: number;
};

/**
 * Group public rated TV diary rows by patron, resolve each title score, then
 * average on the 0–10 display scale (API `community.averageRating`).
 */
export function aggregateResolvedTvPatronScores(
	rows: TvCommunityScoreRow[],
): PublicDiaryCommunityStats {
	const byUser = new Map<string, TvCommunityScoreRow[]>();
	for (const row of rows) {
		const bucket = byUser.get(row.userId);
		if (bucket) bucket.push(row);
		else byUser.set(row.userId, [row]);
	}

	const resolvedTenths: number[] = [];
	for (const logs of byUser.values()) {
		const score = resolveTvTitleScore(logs);
		if (score != null) resolvedTenths.push(score);
	}

	const ratingsCount = resolvedTenths.length;
	if (ratingsCount === 0) {
		return { averageRating: null, ratingsCount: 0 };
	}

	const sumDisplay = resolvedTenths.reduce(
		(acc, tenths) => acc + tenths / 10,
		0,
	);
	return {
		averageRating: sumDisplay / ratingsCount,
		ratingsCount,
	};
}

/**
 * Public patron community score from diary logs — one current rating per patron.
 * Movies: latest public rated log. TV: resolveTvTitleScore over all public rated scopes.
 */
export async function fetchPublicDiaryCommunityStats(
	input: { movieId: number } | { tvId: number },
): Promise<PublicDiaryCommunityStats> {
	const isTv = "tvId" in input;

	if (isTv) {
		const rows = await db
			.select({
				userId: log.userId,
				logScope: log.logScope,
				seasonNumber: log.seasonNumber,
				rating: log.rating,
			})
			.from(log)
			.where(
				and(
					eq(log.tvId, input.tvId),
					eq(log.visibility, "public"),
					isNull(log.removedAt),
					isNotNull(log.rating),
				),
			);

		return aggregateResolvedTvPatronScores(
			rows.filter(
				(row): row is TvCommunityScoreRow =>
					row.rating != null && Number.isFinite(row.rating),
			),
		);
	}

	const baseWhere = and(
		eq(log.movieId, input.movieId),
		eq(log.visibility, "public"),
		isNull(log.removedAt),
		isNotNull(log.rating),
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
