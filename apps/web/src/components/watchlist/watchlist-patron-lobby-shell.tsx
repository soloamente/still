"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import {
	LobbyNavigationProvider,
	useLobbyNavigation,
} from "@/components/lobby/lobby-navigation-provider";
import { WatchlistCatalogOrderChips } from "@/components/watchlist/watchlist-catalog-order-chips";
import { WatchlistLobbyFallback } from "@/components/watchlist/watchlist-lobby-fallback";
import {
	useWatchlistLobbyParams,
	WatchlistLobbyParamsProvider,
} from "@/components/watchlist/watchlist-lobby-params-context";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import { watchlistOrderGridIsStale } from "@/lib/watchlist-lobby-order";

/**
 * Client `/watchlist` chrome — order chips + streamed poster grid.
 * Search lives in sticky chrome / mobile tab bar — no redundant filters rail here.
 */
export function WatchlistPatronLobbyShell({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<LobbyNavigationProvider>
			<WatchlistLobbyParamsProvider>
				<section
					className={cn(
						HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
						"overflow-visible",
					)}
				>
					<div className="flex shrink-0 items-center">
						<WatchlistCatalogOrderChips />
					</div>
					<WatchlistLobbyGridSlot>{children}</WatchlistLobbyGridSlot>
				</section>
			</WatchlistLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}

/**
 * Chip taps use `startTransition`, which can unhide the previous wall before
 * `PopularMoviesInfinite` applies the new seeds (that reset is an effect).
 * Keep the shimmer up until the mounted RSC sort matches the chip.
 */
function WatchlistLobbyGridSlot({ children }: { children: ReactNode }) {
	const { isPending } = useLobbyNavigation();
	const { order, seedOrder } = useWatchlistLobbyParams();
	const showFallback = isPending || watchlistOrderGridIsStale(order, seedOrder);
	return (
		<div
			aria-busy={showFallback}
			className="flex min-h-0 min-w-0 flex-1 flex-col"
		>
			{/* Keep the page Suspense mounted so `startTransition` can finish the RSC. */}
			<div
				className={
					showFallback ? "hidden" : "flex min-h-0 min-w-0 flex-1 flex-col"
				}
			>
				{children}
			</div>
			{showFallback ? <WatchlistLobbyFallback /> : null}
		</div>
	);
}
