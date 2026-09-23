"use client";

import { HomeLobbyFilterScrollRail } from "@/components/home/home-lobby-filter-row";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

const CHIPS: readonly {
	id: WatchlistLobbyOrder;
	label: string;
	title: string;
}[] = [
	{
		id: "tonight",
		label: "Watch tonight",
		title: "Ranked for tonight — streaming, friends, lists, taste",
	},
	{
		id: "available",
		label: "Now available",
		title: "Streaming on your services in your region",
	},
	{
		id: "continue",
		label: "Continue watching",
		title: "Shows you're in the middle of",
	},
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
		title: "Alphabetical by title (A–Z), then newest save",
	},
] as const;

/**
 * Left chip rail on `/watchlist` — sliding `bg-card` pill (diary parity).
 * Six modes stay on one line: the track keeps its natural width (`w-max`) inside the
 * shared lobby scroll rail (horizontal scroll + edge fades on narrow viewports).
 */
export function WatchlistCatalogOrderChips() {
	const { order, selectOrder } = useWatchlistLobbyParams();

	return (
		<div className="flex min-w-0 flex-1 flex-col gap-1">
			<p id="watchlist-catalog-order-desc" className="sr-only">
				Choose how your watchlist is shown — ranked for tonight, streaming now,
				shows in progress, or by save date and title.
			</p>
			<HomeLobbyFilterScrollRail>
				<SegmentedPillToolbar
					layoutId="watchlist-catalog-order-pill"
					aria-label="Watchlist order"
					value={order}
					onChange={selectOrder}
					options={CHIPS}
					compact
					className="w-max max-w-none shrink-0 flex-nowrap justify-start"
				/>
			</HomeLobbyFilterScrollRail>
		</div>
	);
}
