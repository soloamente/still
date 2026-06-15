import { db, log, watchlistItem } from "@still/db";
import { and, countDistinct, eq, isNull, sql } from "drizzle-orm";

/** Minimum aggregate size before patron-facing detail counts are shown. */
export const LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT = 3;

export type ListingCommunityEngagementStats = {
	watchesCount: number | null;
	watchlistCount: number | null;
};

function coerceNonNegativeInt(raw: unknown): number {
	const n = Number(raw ?? 0);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.floor(n);
}

/** Hide aggregate counts below the privacy threshold. */
export function publicListingEngagementCount(raw: unknown): number | null {
	const count = coerceNonNegativeInt(raw);
	return count >= LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT ? count : null;
}

export function coerceListingCommunityEngagementStats(row: {
	watchesRaw: unknown;
	watchlistRaw: unknown;
}): ListingCommunityEngagementStats {
	return {
		watchesCount: publicListingEngagementCount(row.watchesRaw),
		watchlistCount: publicListingEngagementCount(row.watchlistRaw),
	};
}

/**
 * Public watches (distinct patrons with a public diary log) and watchlist totals
 * for movie/TV detail social proof.
 */
export async function fetchListingCommunityEngagementStats(
	input: { movieId: number } | { tvId: number },
): Promise<ListingCommunityEngagementStats> {
	const isTv = "tvId" in input;

	const watchesWhere = and(
		isTv ? eq(log.tvId, input.tvId) : eq(log.movieId, input.movieId),
		eq(log.visibility, "public"),
		isNull(log.removedAt),
	);

	const watchlistWhere = isTv
		? eq(watchlistItem.tvId, input.tvId)
		: eq(watchlistItem.movieId, input.movieId);

	const [watchesRow, watchlistRow] = await Promise.all([
		db
			.select({
				watchesRaw: countDistinct(log.userId),
			})
			.from(log)
			.where(watchesWhere),
		db
			.select({
				watchlistRaw: sql<number>`count(*)::int`.as("watchlistRaw"),
			})
			.from(watchlistItem)
			.where(watchlistWhere),
	]);

	return coerceListingCommunityEngagementStats({
		watchesRaw: watchesRow[0]?.watchesRaw ?? 0,
		watchlistRaw: watchlistRow[0]?.watchlistRaw ?? 0,
	});
}
