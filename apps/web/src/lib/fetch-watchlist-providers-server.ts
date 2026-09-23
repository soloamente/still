import "server-only";

import { serverApi } from "@/lib/server-api";
import type { WatchlistProvidersCatalogPayload } from "@/lib/watchlist-provider-catalogue-types";

/**
 * RSC helper for **`GET /api/watchlist/providers`** — distinct flatrate services
 * across the patron's saves in their chosen watch region (platform logo row).
 */
export async function fetchWatchlistProvidersServer(): Promise<WatchlistProvidersCatalogPayload> {
	try {
		const client = await serverApi();
		const res = await client.api.watchlist.providers.get();
		if (res.error != null) {
			console.error("[fetchWatchlistProvidersServer] failed:", res.error);
			return {
				providers: [],
				region: null,
				needsRegion: true,
				failed: true,
			};
		}
		const data = res.data as unknown as {
			providers?: WatchlistProvidersCatalogPayload["providers"];
			region?: string | null;
			needs_region?: boolean;
		};
		return {
			providers: data.providers ?? [],
			region: data.region ?? null,
			needsRegion: data.needs_region === true,
			failed: false,
		};
	} catch (error) {
		console.error("[fetchWatchlistProvidersServer] threw:", error);
		return {
			providers: [],
			region: null,
			needsRegion: true,
			failed: true,
		};
	}
}
