import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";

/**
 * Route loader for `/watchlist` — overrides the generic `(app)/loading.tsx`
 * skeleton. Only the poster wall is replaced: order chips live in `layout.tsx`
 * so they stay mounted across query-only navigations.
 */
export default function WatchlistLoading() {
	return <WatchlistLobbyFallback />;
}
