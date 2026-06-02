import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import { WatchlistPatronLobbyShell } from "@/components/watchlist/watchlist-patron-lobby-shell";

/**
 * Route loader for `/watchlist` — overrides the generic `(app)/loading.tsx` skeleton.
 * Renders the same shell (order chips + view toolbar) and poster shimmer the page shows
 * while its grid streams, so navigation → content is one continuous loader instead of a
 * generic skeleton that then swaps to a different in-page shimmer. The header is omitted
 * here too (it streams in with no skeleton), matching the page's `fallback={null}` chrome.
 */
export default function WatchlistLoading() {
	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<WatchlistPatronLobbyShell>
				<WatchlistLobbyFallback />
			</WatchlistPatronLobbyShell>
		</div>
	);
}
