import { db, watchlistItem } from "@still/db";
import { and, eq, isNotNull } from "drizzle-orm";

/** Defensive cap — exclusion set only; typical watchlists are much smaller. */
const WATCHLIST_EXCLUSION_CAP = 2000;

/**
 * Movie TMDb ids on the patron's watchlist — excluded from taste For you scoring
 * (same class as logged + dismissed titles).
 */
export async function fetchWatchlistMovieTmdbIds(
	userId: string,
): Promise<number[]> {
	const rows = await db
		.select({ movieId: watchlistItem.movieId })
		.from(watchlistItem)
		.where(
			and(eq(watchlistItem.userId, userId), isNotNull(watchlistItem.movieId)),
		)
		.limit(WATCHLIST_EXCLUSION_CAP);

	return rows
		.map((row) => row.movieId)
		.filter((id): id is number => id != null);
}

/** Merge logged, dismissed, and watchlisted ids for taste candidate exclusion. */
export function buildTasteMatchExcludeIds(input: {
	loggedMovieIds: number[];
	dismissedIds: number[];
	watchlistMovieIds: number[];
}): number[] {
	return [
		...new Set([
			...input.loggedMovieIds,
			...input.dismissedIds,
			...input.watchlistMovieIds,
		]),
	];
}
