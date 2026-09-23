import { BoundedTtlCache } from "./bounded-ttl-cache";
import {
	watchlistLookaheadPageMeta,
	watchlistOffset,
} from "./watchlist-query-args";

/**
 * Ranked-key cache for `tonight` / `available`: the ordered pool (already
 * filtered + scored, with reason and provider) per patron + order + region.
 * Page 1 always re-ranks and refreshes the entry; page 2+ slice it, so a
 * scroll session pages one stable ranking instead of re-querying the 500-row
 * pool and re-scoring on every page.
 */
const RANKED_CACHE_TTL_MS = 60_000;
/** Hard cap — one entry per active patron/mode; oldest evicted first. */
const RANKED_CACHE_MAX_ENTRIES = 500;

const rankedCache = new BoundedTtlCache<readonly unknown[]>(
	RANKED_CACHE_TTL_MS,
	RANKED_CACHE_MAX_ENTRIES,
);

/** Every key starts with `${userId}|` so one patron's slices invalidate together. */
export function watchlistRankedCacheKey(args: {
	userId: string;
	order: "tonight" | "available";
	region: string | null;
	showAdultContent: boolean;
}): string {
	return `${args.userId}|${args.order}|${args.region ?? "-"}|${args.showAdultContent ? 1 : 0}`;
}

export function readWatchlistRanked<T>(key: string): readonly T[] | undefined {
	return rankedCache.get(key) as readonly T[] | undefined;
}

export function writeWatchlistRanked<T>(
	key: string,
	ranked: readonly T[],
): void {
	rankedCache.set(key, ranked);
}

/** Drop a patron's ranked lists (watchlist add/remove, alert toggle). */
export function invalidateWatchlistRanked(userId: string): void {
	rankedCache.deletePrefix(`${userId}|`);
}

/**
 * One page of a ranked list, using the same `limit + 1` lookahead meta as the
 * SQL-paged modes so `total_pages` / `total_results` behave identically.
 */
export function sliceWatchlistRankedPage<T>(
	ranked: readonly T[],
	page: number,
	limit: number,
): { rows: T[]; totalPages: number; totalResults: number } {
	const offset = watchlistOffset(page, limit);
	const window = ranked.slice(offset, offset + limit + 1);
	const meta = watchlistLookaheadPageMeta({
		page,
		limit,
		fetchedCount: window.length,
	});
	return {
		rows: window.slice(0, meta.visibleCount),
		totalPages: meta.totalPages,
		totalResults: offset + meta.visibleCount,
	};
}
