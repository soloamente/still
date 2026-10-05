"use client";

import { Tooltip, TooltipTrigger } from "@still/ui/components/tooltip";
import IconStarFilled from "@still/ui/icons/star-filled";
import { cn } from "@still/ui/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { SearchDialogHorizontalRail } from "@/components/home/search-dialog-horizontal-rail";
import { SearchDialogKeyboardFocusWrap } from "@/components/home/search-dialog-keyboard-focus-wrap";
import { SearchDialogPeopleRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import {
	CatalogSearchTooltipContent,
	SearchDialogRailTooltipProvider,
} from "@/lib/catalog-search-tooltip-portal";
import { posterSampledScrimStyle } from "@/lib/search-dialog-people-portrait-scrim";
import type { SearchDialogPeopleRankMovement } from "@/lib/search-dialog-people-rank-delta";
import {
	SEARCH_DIALOG_RAIL_ENTER_ANIMATE,
	SEARCH_DIALOG_RAIL_ENTER_TRANSITION,
	searchDialogRailEnterInitial,
} from "@/lib/search-dialog-tab-pane-motion";
import { useSearchDialogPeoplePortraitScrimColor } from "@/lib/use-search-dialog-people-portrait-scrim-color";

export type SearchDialogPeopleRailItem = {
	id: string;
	name: string;
	imageUrl: string | null;
	rankLabel?: string;
	/** Present on Sense traffic-ranked popular people; omitted for patron rails. */
	rankMovement?: SearchDialogPeopleRankMovement;
	/** Viewer Favorite — star mark on the tile. */
	isFavorited?: boolean;
};

function SearchDialogPeopleRailTile({
	item,
	rank,
}: {
	item: SearchDialogPeopleRailItem;
	rank: string;
}) {
	const scrimColor = useSearchDialogPeoplePortraitScrimColor(item.imageUrl);
	const initial = item.name.trim().charAt(0).toUpperCase() || "?";
	const movement = item.rankMovement;
	const showUp = movement === "up";
	const showDown = movement === "down";

	return (
		<>
			{item.imageUrl ? (
				// biome-ignore lint/performance/noImgElement: remote TMDb / avatar host, tiny tile
				<img
					src={item.imageUrl}
					alt=""
					width={64}
					height={64}
					className="size-16 object-cover"
					loading="lazy"
					decoding="async"
				/>
			) : (
				<span className="flex size-16 items-center justify-center font-semibold text-muted-foreground text-sm">
					{initial}
				</span>
			)}
			{/* Same bottom fade as poster captions — full tile, clear by the upper half. */}
			<span
				aria-hidden
				className="pointer-events-none absolute inset-0 opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:opacity-0"
				style={posterSampledScrimStyle(scrimColor)}
			/>
			{/* Rank + movement — centered along the bottom edge, not mid-portrait. */}
			<span className="pointer-events-none absolute inset-x-0 bottom-1.5 flex items-center justify-center gap-0.5 px-1 opacity-100 transition-opacity duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:group-hover:opacity-0">
				{showUp ? (
					<ArrowUp
						className="size-3 shrink-0 text-emerald-400 drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.65)]"
						aria-hidden
						strokeWidth={2.75}
					/>
				) : null}
				{showDown ? (
					<ArrowDown
						className="size-3 shrink-0 text-crimson-blush drop-shadow-[0_1px_1px_rgb(0_0_0_/_0.65)]"
						aria-hidden
						strokeWidth={2.75}
					/>
				) : null}
				<span
					className={cn(
						"font-semibold text-sm text-white tabular-nums leading-none",
						"[text-shadow:0_1px_2px_rgb(0_0_0_/_0.75)]",
					)}
				>
					{rank}
				</span>
			</span>
			{item.isFavorited ? (
				<span
					className="pointer-events-none absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-background/90 text-foreground"
					aria-hidden
				>
					<IconStarFilled size="12px" />
				</span>
			) : null}
		</>
	);
}

/**
 * 64px square portrait rail — Figma people row under the poster strip.
 */
export function SearchDialogPeopleRail({
	items,
	loading,
	onPick,
	label = "People",
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	items: SearchDialogPeopleRailItem[];
	loading?: boolean;
	onPick: (item: SearchDialogPeopleRailItem) => void;
	label?: string;
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const reduceMotion = useReducedMotion();
	if (!loading && items.length === 0) return null;

	const contentKey = [
		loading ? "loading" : "ready",
		items.map((item) => `${item.id}:${item.rankMovement ?? ""}`).join(","),
	].join("\0");

	return (
		<SearchDialogHorizontalRail
			label={label}
			contentKey={contentKey}
			enabled={loading || items.length > 0}
			gapClassName="gap-2.5"
		>
			{loading && items.length === 0 ? (
				<SearchDialogPeopleRailSkeleton />
			) : (
				<SearchDialogRailTooltipProvider>
					<motion.div
						key={contentKey}
						className="flex shrink-0 items-center gap-2.5"
						initial={searchDialogRailEnterInitial(reduceMotion)}
						animate={SEARCH_DIALOG_RAIL_ENTER_ANIMATE}
						transition={SEARCH_DIALOG_RAIL_ENTER_TRANSITION}
					>
						{items.map((item, index) => {
							const resultIndex = resultIndexBase + index;
							const keyboardFocused = keyboardFocusedIndex === resultIndex;
							const rank = item.rankLabel ?? String(index + 1);
							const movementLabel =
								item.rankMovement === "up"
									? ", up in rankings"
									: item.rankMovement === "down"
										? ", down in rankings"
										: "";
							const favoritedLabel = item.isFavorited ? ", favorited" : "";
							return (
								<Tooltip key={item.id}>
									<TooltipTrigger
										render={
											<SearchDialogKeyboardFocusWrap
												focused={keyboardFocused}
												className="rounded-2xl"
											>
												<button
													type="button"
													data-search-dialog-result-index={resultIndex}
													aria-label={`${item.name}, rank ${rank}${movementLabel}${favoritedLabel}`}
													onClick={() => onPick(item)}
													className="group relative size-16 shrink-0 overflow-hidden rounded-2xl bg-card outline-none"
												>
													<SearchDialogPeopleRailTile item={item} rank={rank} />
												</button>
											</SearchDialogKeyboardFocusWrap>
										}
									/>
									<CatalogSearchTooltipContent side="top">
										{item.name}
									</CatalogSearchTooltipContent>
								</Tooltip>
							);
						})}
					</motion.div>
				</SearchDialogRailTooltipProvider>
			)}
		</SearchDialogHorizontalRail>
	);
}
