"use client";

import { Tooltip, TooltipTrigger } from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { SearchDialogHorizontalRail } from "@/components/home/search-dialog-horizontal-rail";
import { SearchDialogKeyboardFocusWrap } from "@/components/home/search-dialog-keyboard-focus-wrap";
import { SearchDialogPosterRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { MoviePoster } from "@/components/movie/movie-poster";
import {
	CatalogSearchTooltipContent,
	SearchDialogRailTooltipProvider,
} from "@/lib/catalog-search-tooltip-portal";
import {
	SEARCH_DIALOG_RAIL_ENTER_ANIMATE,
	SEARCH_DIALOG_RAIL_ENTER_TRANSITION,
	searchDialogRailEnterInitial,
} from "@/lib/search-dialog-tab-pane-motion";
import type { SearchDialogBrowsePreviewItem } from "@/lib/use-search-dialog-browse-preview";

/** Figma poster tiles are ~150×214 with a 10px gutter. */
const POSTER_TILE_CLASS = "w-[9.4rem] shrink-0";

export type SearchDialogPosterRailItem = {
	id: number;
	title: string;
	posterUrl: string | null;
	listingKind: "movie" | "tv";
};

/**
 * Large horizontal poster rail for browse + search hits (no under-frame titles).
 */
export function SearchDialogPosterRail({
	items,
	loading,
	onPick,
	label = "Titles",
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	items: SearchDialogPosterRailItem[] | SearchDialogBrowsePreviewItem[];
	loading?: boolean;
	onPick: (item: SearchDialogPosterRailItem) => void;
	label?: string;
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const reduceMotion = useReducedMotion();
	const railRef = useRef<HTMLDivElement>(null);
	if (!loading && items.length === 0) return null;

	const contentKey = [
		loading ? "loading" : "ready",
		items.map((item) => `${item.listingKind}-${item.id}`).join(","),
	].join("\0");

	return (
		<SearchDialogHorizontalRail
			label={label}
			contentKey={contentKey}
			enabled={loading || items.length > 0}
			gapClassName="gap-2.5"
			scrollClassName="items-stretch"
		>
			{loading && items.length === 0 ? (
				<SearchDialogPosterRailSkeleton />
			) : (
				<SearchDialogRailTooltipProvider>
					<motion.div
						ref={railRef}
						key={contentKey}
						className="flex shrink-0 items-stretch gap-2.5"
						initial={searchDialogRailEnterInitial(reduceMotion)}
						animate={SEARCH_DIALOG_RAIL_ENTER_ANIMATE}
						transition={SEARCH_DIALOG_RAIL_ENTER_TRANSITION}
					>
						{items.map((item, index) => {
							const resultIndex = resultIndexBase + index;
							const keyboardFocused = keyboardFocusedIndex === resultIndex;
							return (
								<Tooltip key={`${item.listingKind}-${item.id}`}>
									<TooltipTrigger
										render={
											<SearchDialogKeyboardFocusWrap
												focused={keyboardFocused}
												className="rounded-2xl"
											>
												<button
													type="button"
													data-search-dialog-result-index={resultIndex}
													aria-label={item.title}
													className={`${POSTER_TILE_CLASS} cursor-pointer rounded-2xl text-left outline-none`}
													onClick={() => onPick(item)}
												>
													<MoviePoster
														movieId={item.id}
														title={item.title}
														posterUrl={item.posterUrl}
														size="md"
														showTitle={false}
														linkable={false}
														listingKind={item.listingKind}
														frameClassName="rounded-2xl"
													/>
												</button>
											</SearchDialogKeyboardFocusWrap>
										}
									/>
									<CatalogSearchTooltipContent side="top">
										{item.title}
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
