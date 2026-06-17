import { db, list, listItem, log, watchlistItem } from "@still/db";
import { and, countDistinct, eq, isNull, notExists, sql } from "drizzle-orm";

export type ListingCommunityEngagementStats = {
	watchesCount: number;
	listsCount: number;
	favoritesCount: number;
	watchlistCount: number;
};

function coerceNonNegativeInt(raw: unknown): number {
	const n = Number(raw ?? 0);
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.floor(n);
}

export type ListingEngagementListingRef =
	| { movieId: number }
	| { tvId: number };

/**
 * Letterboxd-shaped watchlist semantics — patrons with any non-removed diary log for
 * this title are excluded from watchlist aggregates (matches `/api/watchlist` hide-watched).
 */
export function watchlistPatronHasNotWatchedTitle(
	listing: ListingEngagementListingRef,
) {
	const isTv = "tvId" in listing;
	const listingLogMatch = isTv
		? eq(log.tvId, listing.tvId)
		: eq(log.movieId, listing.movieId);

	return notExists(
		db
			.select({ one: sql`1` })
			.from(log)
			.where(
				and(
					eq(log.userId, watchlistItem.userId),
					isNull(log.removedAt),
					listingLogMatch,
				),
			),
	);
}

/** Map raw SQL aggregates to always-on public engagement counts (Letterboxd-style chips). */
export function coerceListingCommunityEngagementStats(row: {
	watchesRaw: unknown;
	listsRaw: unknown;
	favoritesRaw: unknown;
	watchlistRaw: unknown;
}): ListingCommunityEngagementStats {
	return {
		watchesCount: coerceNonNegativeInt(row.watchesRaw),
		listsCount: coerceNonNegativeInt(row.listsRaw),
		favoritesCount: coerceNonNegativeInt(row.favoritesRaw),
		watchlistCount: coerceNonNegativeInt(row.watchlistRaw),
	};
}

/**
 * Global engagement totals for movie/TV detail chips — distinct patrons, all lists,
 * diary favorites, and watchlist rows (includes private activity in aggregates).
 */
export async function fetchListingCommunityEngagementStats(
	input: { movieId: number } | { tvId: number },
): Promise<ListingCommunityEngagementStats> {
	const isTv = "tvId" in input;

	const logListingWhere = and(
		isTv ? eq(log.tvId, input.tvId) : eq(log.movieId, input.movieId),
		isNull(log.removedAt),
	);

	const watchlistWhere = isTv
		? eq(watchlistItem.tvId, input.tvId)
		: eq(watchlistItem.movieId, input.movieId);

	const listItemWhere = and(
		isTv ? eq(listItem.tvId, input.tvId) : eq(listItem.movieId, input.movieId),
		isNull(list.removedAt),
	);

	const favoritesWhere = and(logListingWhere, eq(log.liked, true));

	const [watchesRow, listsRow, favoritesRow, watchlistRow] = await Promise.all([
		db
			.select({
				watchesRaw: countDistinct(log.userId),
			})
			.from(log)
			.where(logListingWhere),
		db
			.select({
				listsRaw: sql<number>`count(*)::int`.as("listsRaw"),
			})
			.from(listItem)
			.innerJoin(list, eq(listItem.listId, list.id))
			.where(listItemWhere),
		db
			.select({
				favoritesRaw: countDistinct(log.userId),
			})
			.from(log)
			.where(favoritesWhere),
		db
			.select({
				watchlistRaw: sql<number>`count(*)::int`.as("watchlistRaw"),
			})
			.from(watchlistItem)
			.where(and(watchlistWhere, watchlistPatronHasNotWatchedTitle(input))),
	]);

	return coerceListingCommunityEngagementStats({
		watchesRaw: watchesRow[0]?.watchesRaw ?? 0,
		listsRaw: listsRow[0]?.listsRaw ?? 0,
		favoritesRaw: favoritesRow[0]?.favoritesRaw ?? 0,
		watchlistRaw: watchlistRow[0]?.watchlistRaw ?? 0,
	});
}
