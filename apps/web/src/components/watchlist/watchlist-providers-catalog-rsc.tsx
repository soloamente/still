import { WatchlistProviderFilterChrome } from "@/components/watchlist/watchlist-provider-filter-chrome";
import { fetchWatchlistProvidersServer } from "@/lib/fetch-watchlist-providers-server";

/** Parallel RSC fetch for the platform logo row (layout shell, not the poster grid). */
export async function WatchlistProvidersCatalogRsc() {
	const payload = await fetchWatchlistProvidersServer();
	return <WatchlistProviderFilterChrome payload={payload} />;
}
