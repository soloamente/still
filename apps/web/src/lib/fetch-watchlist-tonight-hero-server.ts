import "server-only";

import { serverApi } from "@/lib/server-api";
import {
	isWatchlistRowWithListing,
	type WatchlistLobbyRow,
} from "@/lib/watchlist-lobby-order";
import {
	type WatchlistTonightHeroPayload,
	watchlistRowToTonightHeroPick,
} from "@/lib/watchlist-tonight-hero-types";

/** Matches spec pool size for **Pick another** rotation. */
export const WATCHLIST_TONIGHT_HERO_POOL_LIMIT = 12;

/**
 * RSC helper — ranked tonight pool for the watchlist hero (`order=tonight`).
 * Trailer/logo hydration runs on the client when the spotlight is a film.
 */
export async function fetchWatchlistTonightHeroServer(): Promise<WatchlistTonightHeroPayload> {
	try {
		const client = await serverApi();
		const res = await client.api.watchlist.get({
			query: {
				page: "1",
				limit: String(WATCHLIST_TONIGHT_HERO_POOL_LIMIT),
				order: "tonight",
			},
		});
		if (res.error != null) {
			console.error("[fetchWatchlistTonightHeroServer] failed:", res.error);
			return { pool: [], failed: true, region: undefined };
		}
		const data = res.data as unknown as {
			results?: WatchlistLobbyRow[];
			region?: string | null;
		} | null;
		const rows = Array.isArray(data?.results) ? data.results : [];
		const pool = rows
			.filter(isWatchlistRowWithListing)
			.map((row) => watchlistRowToTonightHeroPick(row));
		return {
			pool,
			failed: false,
			region:
				typeof data?.region === "string" || data?.region === null
					? data.region
					: undefined,
		};
	} catch (err) {
		console.error("[fetchWatchlistTonightHeroServer] threw:", err);
		return { pool: [], failed: true, region: undefined };
	}
}
