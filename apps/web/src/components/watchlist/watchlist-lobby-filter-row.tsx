"use client";

import { cn } from "@still/ui/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { HomeLobbyFilterRow } from "@/components/home/home-lobby-filter-row";
import { WatchlistCatalogFiltersPopover } from "@/components/watchlist/watchlist-catalog-filters-popover";
import { WatchlistCatalogSortToolbar } from "@/components/watchlist/watchlist-catalog-order-chips";
import { HOME_LOBBY_CHIP_TRACK_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import {
	buildWatchlistLobbyHref,
	parseWatchlistLobbyOrder,
} from "@/lib/watchlist-lobby-order";
import { parseWatchlistProviderIds } from "@/lib/watchlist-provider-filter";

/** Task 7 mounts the composite provider pill into this anchor (left of the filters icon). */
export const WATCHLIST_PROVIDER_PILL_SLOT_ID = "watchlist-provider-pill-slot";

/**
 * Sort chips (leading scroll rail) + provider pill slot + filters popover (trailing chip track).
 */
export function WatchlistLobbyFilterRow() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const consumedFiltersParamRef = useRef(false);

	// Legacy `?order=available` redirect lands with `?filters=1` — open once, then strip the flag.
	useEffect(() => {
		if (consumedFiltersParamRef.current) return;
		if (searchParams.get("filters") !== "1") return;
		consumedFiltersParamRef.current = true;
		setFiltersOpen(true);
		const order = parseWatchlistLobbyOrder(searchParams.get("order"));
		const providers = parseWatchlistProviderIds(searchParams.get("providers"));
		router.replace(buildWatchlistLobbyHref({ order, providers }), {
			scroll: false,
		});
	}, [router, searchParams]);

	return (
		<HomeLobbyFilterRow
			leading={<WatchlistCatalogSortToolbar />}
			trailing={
				<div className="flex shrink-0 items-center gap-1">
					<div
						id={WATCHLIST_PROVIDER_PILL_SLOT_ID}
						className="flex min-w-0 items-center empty:hidden"
					/>
					<div
						className={cn(
							HOME_LOBBY_CHIP_TRACK_CLASSNAME,
							"flex shrink-0 items-center",
						)}
						role="toolbar"
						aria-label="Watchlist filters"
					>
						<WatchlistCatalogFiltersPopover
							open={filtersOpen}
							onOpenChange={setFiltersOpen}
						/>
					</div>
				</div>
			}
		/>
	);
}
