"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

const CHIPS: readonly {
	id: WatchlistLobbyOrder;
	label: string;
	title: string;
	ariaLabel: string;
}[] = [
	{
		id: "latest_added",
		label: "Recently added",
		title: "Newest saves first — when you clipped each title",
		ariaLabel: "Recently added — order by when you saved the title",
	},
	{
		id: "earliest_added",
		label: "Oldest saves",
		title: "Oldest clips first — chronological from your first save",
		ariaLabel: "Oldest saves — order by oldest added date first",
	},
	{
		id: "title_az",
		label: "By title",
		title:
			"Alphabetical by film title (A–Z), then newest save within the same title",
		ariaLabel: "By title — alphabetical order",
	},
] as const;

/**
 * Left chip rail on `/watchlist` — patron-facing order (diary parity).
 */
export function WatchlistCatalogOrderChips() {
	const { order, selectOrder } = useWatchlistLobbyParams();
	const reduceMotion = useReducedMotion();

	const pillTransition = reduceMotion
		? { duration: 0 }
		: {
				type: "tween" as const,
				duration: 0.22,
				ease: [0.165, 0.84, 0.44, 1] as const,
			};

	const chipButton = (active: boolean) =>
		cn(
			"relative inline-flex min-h-10 items-center justify-center rounded-full px-3 py-2 text-center font-medium text-sm transition-colors duration-200 ease-out motion-reduce:transition-none sm:px-3.5",
			active
				? "text-foreground"
				: "text-muted-foreground [@media(hover:hover)]:hover:text-foreground/90",
		);

	const sortToolbarDescId = "watchlist-catalog-order-desc";

	return (
		<div className="flex min-w-0 flex-col gap-1">
			<p id={sortToolbarDescId} className="sr-only">
				Choose how your watchlist is ordered in the poster wall — by when you
				saved titles or alphabetically by film title.
			</p>
			<div
				className="flex max-w-full flex-wrap gap-1 rounded-full bg-background p-1 sm:flex-nowrap"
				role="toolbar"
				aria-label="Watchlist order"
				aria-describedby={sortToolbarDescId}
			>
				{CHIPS.map(({ id, label, title, ariaLabel }) => (
					<button
						key={id}
						type="button"
						aria-current={order === id ? "page" : undefined}
						className={chipButton(order === id)}
						title={title}
						aria-label={ariaLabel}
						onClick={() => selectOrder(id)}
					>
						{order === id ? (
							<motion.span
								layoutId="watchlist-catalog-order-pill"
								className="absolute inset-0 z-0 rounded-full bg-card"
								transition={pillTransition}
							/>
						) : null}
						<span className="relative z-10">{label}</span>
					</button>
				))}
			</div>
		</div>
	);
}
