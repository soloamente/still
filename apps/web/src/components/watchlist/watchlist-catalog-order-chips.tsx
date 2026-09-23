"use client";

import { useReducedMotion } from "motion/react";
import { useLayoutEffect, useRef } from "react";

import { HomeLobbyFilterScrollRail } from "@/components/home/home-lobby-filter-row";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import type { WatchlistLobbyOrder } from "@/lib/watchlist-lobby-order";

const CHIPS: readonly {
	id: WatchlistLobbyOrder;
	label: string;
	/** Below `sm` — the full `label` stays the accessible name. */
	shortLabel: string;
	title: string;
}[] = [
	{
		id: "latest_added",
		label: "Recently added",
		shortLabel: "Recent",
		title: "Newest saves first — when you clipped each title",
	},
	{
		id: "earliest_added",
		label: "Oldest saves",
		shortLabel: "Oldest",
		title: "Oldest clips first — chronological from your first save",
	},
	{
		id: "title_az",
		label: "By title",
		shortLabel: "A–Z",
		title: "Alphabetical by title (A–Z), then newest save",
	},
] as const;

/** Short visible label on phones; full label visible from `sm` and always read by SR. */
const CHIP_OPTIONS = CHIPS.map((chip) => ({
	id: chip.id,
	title: chip.title,
	label: (
		<>
			<span aria-hidden className="sm:hidden">
				{chip.shortLabel}
			</span>
			<span className="max-sm:sr-only">{chip.label}</span>
		</>
	),
}));

/** Nearest ancestor that actually scrolls horizontally (the lobby scroll rail). */
function horizontalScrollParent(element: HTMLElement): HTMLElement | null {
	let node = element.parentElement;
	while (node) {
		const { overflowX } = getComputedStyle(node);
		if (
			(overflowX === "auto" || overflowX === "scroll") &&
			node.scrollWidth > node.clientWidth
		)
			return node;
		node = node.parentElement;
	}
	return null;
}

/**
 * Left chip rail on `/watchlist` — sliding `bg-card` pill (diary parity).
 * Three sort modes on one line inside the shared lobby scroll rail.
 */
export function WatchlistCatalogOrderChips() {
	const { order, selectOrder } = useWatchlistLobbyParams();
	const reduceMotion = useReducedMotion();
	const rootRef = useRef<HTMLDivElement>(null);
	const initialOrderRef = useRef(order);
	const reduceMotionRef = useRef(reduceMotion);

	// Deep links (e.g. `?order=title_az`) can land on a chip past the rail's edge —
	// center it once on mount; later taps are on-screen already.
	useLayoutEffect(() => {
		const chip = rootRef.current?.querySelector<HTMLElement>(
			`[data-segment-id="${CSS.escape(initialOrderRef.current)}"]`,
		);
		if (!chip) return;
		const rail = horizontalScrollParent(chip);
		if (!rail) return;
		const railRect = rail.getBoundingClientRect();
		const chipRect = chip.getBoundingClientRect();
		const outOfView =
			chipRect.left < railRect.left || chipRect.right > railRect.right;
		if (!outOfView) return;
		rail.scrollTo({
			left:
				rail.scrollLeft +
				(chipRect.left - railRect.left) -
				(railRect.width - chipRect.width) / 2,
			behavior: reduceMotionRef.current ? "auto" : "smooth",
		});
	}, []);

	return (
		<div ref={rootRef} className="flex min-w-0 flex-1 flex-col gap-1">
			<p id="watchlist-catalog-order-desc" className="sr-only">
				Choose how your watchlist is sorted — recently added, oldest saves, or
				by title.
			</p>
			<HomeLobbyFilterScrollRail>
				<SegmentedPillToolbar
					layoutId="watchlist-catalog-order-pill"
					aria-label="Watchlist order"
					value={order}
					onChange={selectOrder}
					options={CHIP_OPTIONS}
					compact
					className="w-max max-w-none shrink-0 flex-nowrap justify-start"
				/>
			</HomeLobbyFilterScrollRail>
		</div>
	);
}
