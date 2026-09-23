import { type ReactNode, Suspense } from "react";

import { WatchlistChrome } from "@/components/watchlist/watchlist-lobby-chrome";
import { WatchlistLobbyDisplayPrefsProvider } from "@/components/watchlist/watchlist-lobby-display-prefs";
import { WatchlistLobbyTopRsc } from "@/components/watchlist/watchlist-lobby-top-rsc";
import { WatchlistPatronLobbyShell } from "@/components/watchlist/watchlist-patron-lobby-shell";
import { WatchlistTonightHeroSkeleton } from "@/components/watchlist/watchlist-tonight-hero-skeleton";

/**
 * Persistent `/watchlist` chrome. Order chips live here so query-only navigations
 * (`?order=`) do not remount the pill rail — `loading.tsx` only replaces `children`
 * (the poster wall), which is what keeps the sliding chip indicator alive.
 */
export default function WatchlistLayout({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<WatchlistLobbyDisplayPrefsProvider>
				{/* No fallback — the header just appears; no separate "UI" loader. */}
				<Suspense fallback={null}>
					<WatchlistChrome />
				</Suspense>
				<WatchlistPatronLobbyShell
					top={
						<Suspense fallback={<WatchlistTonightHeroSkeleton />}>
							<WatchlistLobbyTopRsc />
						</Suspense>
					}
				>
					{children}
				</WatchlistPatronLobbyShell>
			</WatchlistLobbyDisplayPrefsProvider>
		</div>
	);
}
