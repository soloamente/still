"use client";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

const CHIPS: readonly {
	id: WatchlistLobbyOrder;
	label: string;
	title: string;
}[] = [
	{
		id: "latest_added",
		label: "Recently added",
		title: "Newest saves first — when you clipped each title",
	},
	{
		id: "earliest_added",
		label: "Oldest saves",
		title: "Oldest clips first — chronological from your first save",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by film title (A–Z), then newest save within the same title",
	},
] as const;

/**
 * Left chip rail on `/watchlist` — liquid-gooey Move pill (diary parity).
 */
export function WatchlistCatalogOrderChips() {
	const { order, selectOrder } = useWatchlistLobbyParams();

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id="watchlist-catalog-order-desc" className="sr-only">
				Choose how your watchlist is ordered in the poster wall — by when you
				saved titles or alphabetically by film title.
			</p>
			<SegmentedPillToolbar
				layoutId="watchlist-catalog-order-pill"
				aria-label="Watchlist order"
				value={order}
				onChange={selectOrder}
				options={CHIPS}
				compact
				className="max-w-full flex-nowrap justify-start"
			/>
		</div>
	);
}
