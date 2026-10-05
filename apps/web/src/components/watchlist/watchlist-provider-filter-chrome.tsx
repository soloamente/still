"use client";

import { WatchlistPlatformRow } from "@/components/watchlist/watchlist-platform-row";
import { WatchlistProviderFilterPill } from "@/components/watchlist/watchlist-provider-filter-pill";
import { WatchlistProviderFlyProvider } from "@/components/watchlist/watchlist-provider-fly-context";
import { WatchlistProviderFlyLayer } from "@/components/watchlist/watchlist-provider-fly-layer";
import { WatchlistProvidersCatalogProvider } from "@/components/watchlist/watchlist-providers-catalog-context";
import type { WatchlistProvidersCatalogPayload } from "@/lib/watchlist-provider-catalogue-types";

/**
 * Client shell for platform row + composite pill — seeded from RSC provider catalogue fetch.
 */
export function WatchlistProviderFilterChrome({
	payload,
}: {
	payload: WatchlistProvidersCatalogPayload;
}) {
	return (
		<WatchlistProvidersCatalogProvider payload={payload}>
			<WatchlistProviderFlyProvider>
				<WatchlistProviderFilterPill />
				<WatchlistPlatformRow />
				<WatchlistProviderFlyLayer />
			</WatchlistProviderFlyProvider>
		</WatchlistProvidersCatalogProvider>
	);
}
