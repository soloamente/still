/**
 * Pure query-arg helpers for `GET /api/watchlist` pagination + sort. Kept separate
 * from the route so the parsing/clamp/offset math is unit-testable without a DB.
 */
export type WatchlistOrder = "latest_added" | "earliest_added" | "title_az";

export const WATCHLIST_DEFAULT_LIMIT = 24;
export const WATCHLIST_MAX_LIMIT = 60;

export function parseWatchlistPage(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return 1;
	return Math.floor(n);
}

export function parseWatchlistLimit(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 1) return WATCHLIST_DEFAULT_LIMIT;
	return Math.min(Math.floor(n), WATCHLIST_MAX_LIMIT);
}

export function parseWatchlistOrder(raw: string | undefined): WatchlistOrder {
	if (
		raw === "earliest_added" ||
		raw === "title_az" ||
		raw === "latest_added"
	) {
		return raw;
	}
	return "latest_added";
}

export function watchlistOffset(page: number, limit: number): number {
	return Math.max(0, (page - 1) * limit);
}

export function watchlistTotalPages(total: number, limit: number): number {
	if (total <= 0 || limit <= 0) return 0;
	return Math.ceil(total / limit);
}
