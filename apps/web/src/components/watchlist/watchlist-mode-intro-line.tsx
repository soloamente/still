"use client";

import { cn } from "@still/ui/lib/utils";

import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import { watchlistModeIntroCopy } from "@/lib/watchlist-mode-intro";

/**
 * Quiet mode explainer under the chip rail — makes each sort feel intentional
 * instead of identical poster walls with streaming pills everywhere.
 */
export function WatchlistModeIntroLine({ className }: { className?: string }) {
	const { order, seedOrder, gridTotalResults } = useWatchlistLobbyParams();
	// Hide the count while the chip has moved but the RSC wall is still the old mode.
	const count =
		seedOrder === order && gridTotalResults != null
			? gridTotalResults
			: undefined;
	return (
		<p
			className={cn(
				"text-pretty px-1 text-center text-muted-foreground text-sm leading-snug sm:px-2",
				className,
			)}
		>
			{watchlistModeIntroCopy(order, { totalResults: count })}
		</p>
	);
}
