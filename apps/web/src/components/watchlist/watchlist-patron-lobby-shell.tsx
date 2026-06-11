"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { WatchlistCatalogOrderChips } from "@/components/watchlist/watchlist-catalog-order-chips";
import { WatchlistLobbyParamsProvider } from "@/components/watchlist/watchlist-lobby-params-context";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

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
					{children}
				</section>
			</WatchlistLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}
