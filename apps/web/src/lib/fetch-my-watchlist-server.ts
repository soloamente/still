import "server-only";

import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { serverApi } from "@/lib/server-api";
import {
	decorateWatchlistSeedsForMode,
	isWatchlistRowWithListing,
	parseWatchlistLobbyOrder,
	WATCHLIST_PAGE_SIZE,
	type WatchlistLobbyRow,
	watchlistRowToPopularSeed,
} from "@/lib/watchlist-lobby-order";
import { formatWatchlistProviderQuery } from "@/lib/watchlist-provider-filter";

/**
 * RSC helper for page 1 of **`GET /api/watchlist`** — forwards the visitor's
 * cookies via Eden and returns poster seeds + pagination meta for the lobby.
 *
 * `needsRegion` — `order=available` with no chosen watch region (server returns an
 * empty page flagged `needs_region`). `failed` — request errored; the lobby shows a
 * retry state instead of the empty-watchlist copy.
 */
export async function fetchMyWatchlistServer(opts: {
	order: string;
	providers?: readonly number[];
}): Promise<{
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	needsRegion: boolean;
	/** ISO code, `"ALL"` (all countries), or null (unset); `undefined` when unknown. */
	region: string | null | undefined;
	failed: boolean;
}> {
	try {
		const client = await serverApi();
		const providers = opts.providers ?? [];
		const res = await client.api.watchlist.get({
			query: {
				page: "1",
				limit: String(WATCHLIST_PAGE_SIZE),
				order: opts.order,
				...(providers.length > 0
					? { providers: formatWatchlistProviderQuery(providers) }
					: {}),
			},
		});
		if (res.error != null) {
			console.error("[fetchMyWatchlistServer] failed:", res.error);
			return {
				seeds: [],
				totalPages: 0,
				totalResults: 0,
				needsRegion: false,
				region: undefined,
				failed: true,
			};
		}
		const data = res.data as unknown as {
			results?: WatchlistLobbyRow[];
			total_pages?: number;
			total_results?: number;
			needs_region?: boolean;
			region?: string | null;
		} | null;
		const rows = Array.isArray(data?.results) ? data.results : [];
		const lobbyOrder = parseWatchlistLobbyOrder(opts.order);
		const seeds = decorateWatchlistSeedsForMode(
			rows
				.filter(isWatchlistRowWithListing)
				.map((row) => watchlistRowToPopularSeed(row, lobbyOrder)),
			lobbyOrder,
		);
		return {
			seeds,
			totalPages: typeof data?.total_pages === "number" ? data.total_pages : 1,
			totalResults:
				typeof data?.total_results === "number"
					? data.total_results
					: seeds.length,
			needsRegion: data?.needs_region === true,
			// Older servers omit the field — treat as unknown so no guidance shows.
			region:
				typeof data?.region === "string" || data?.region === null
					? data.region
					: undefined,
			failed: false,
		};
	} catch (err) {
		console.error("[fetchMyWatchlistServer] threw:", err);
		return {
			seeds: [],
			totalPages: 0,
			totalResults: 0,
			needsRegion: false,
			region: undefined,
			failed: true,
		};
	}
}
