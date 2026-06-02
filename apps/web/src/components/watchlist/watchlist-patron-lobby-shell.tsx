"use client";

import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

import { HomeCatalogViewModeToolbar } from "@/components/home/home-catalog-view-mode-toolbar";
import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import { WatchlistCatalogOrderChips } from "@/components/watchlist/watchlist-catalog-order-chips";
import { WatchlistLobbyParamsProvider } from "@/components/watchlist/watchlist-lobby-params-context";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

/**
 * Client `/watchlist` chrome — renders the order chips + view toolbar instantly,
 * then slots in the streamed poster grid (`children`). Order is URL-driven so the
 * server can seed page 1 in the same order the chips show.
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
					<div className="flex shrink-0 items-center justify-between gap-3">
						<WatchlistCatalogOrderChips />
						<HomeCatalogViewModeToolbar />
					</div>
					{children}
				</section>
			</WatchlistLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}
