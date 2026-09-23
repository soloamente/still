import "server-only";

import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { serverApi } from "@/lib/server-api";
import {
	isWatchlistRowWithListing,
	WATCHLIST_PAGE_SIZE,
	type WatchlistLobbyRow,
	watchlistRowToPopularSeed,
} from "@/lib/watchlist-lobby-order";

/**
 * RSC helper for page 1 of **`GET /api/watchlist`** — forwards the visitor's
 * cookies via Eden and returns poster seeds + pagination meta for the lobby.
 *
 * `needsRegion` — `order=available` with no chosen watch region (server returns an
 * empty page flagged `needs_region`). `failed` — request errored; the lobby shows a
 * retry state instead of the empty-watchlist copy.
 */
export async function fetchMyWatchlistServer(opts: { order: string }): Promise<{
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	needsRegion: boolean;
	failed: boolean;
}> {
	try {
		const client = await serverApi();
		const res = await client.api.watchlist.get({
			query: {
				page: "1",
				limit: String(WATCHLIST_PAGE_SIZE),
				order: opts.order,
			},
		});
		if (res.error != null) {
			console.error("[fetchMyWatchlistServer] failed:", res.error);
			return {
				seeds: [],
				totalPages: 0,
				totalResults: 0,
				needsRegion: false,
				failed: true,
			};
		}
		const data = res.data as unknown as {
			results?: WatchlistLobbyRow[];
			total_pages?: number;
			total_results?: number;
			needs_region?: boolean;
		} | null;
		const rows = Array.isArray(data?.results) ? data.results : [];
		const seeds = rows
			.filter(isWatchlistRowWithListing)
			.map(watchlistRowToPopularSeed);
		return {
			seeds,
			totalPages: typeof data?.total_pages === "number" ? data.total_pages : 1,
			totalResults:
				typeof data?.total_results === "number"
					? data.total_results
					: seeds.length,
			needsRegion: data?.needs_region === true,
			failed: false,
		};
	} catch (err) {
		console.error("[fetchMyWatchlistServer] threw:", err);
		return {
			seeds: [],
			totalPages: 0,
			totalResults: 0,
			needsRegion: false,
			failed: true,
		};
	}
}
