"use client";

import { Tooltip, TooltipTrigger } from "@still/ui/components/tooltip";
import { cn } from "@still/ui/lib/utils";
import { useEffect, useRef } from "react";
import { SearchDialogKeyboardFocusWrap } from "@/components/home/search-dialog-keyboard-focus-wrap";
import type { SearchDialogPosterRailItem } from "@/components/home/search-dialog-poster-rail";
import { SearchDialogPosterGridSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { MoviePoster } from "@/components/movie/movie-poster";
import {
	CatalogSearchTooltipContent,
	SearchDialogRailTooltipProvider,
} from "@/lib/catalog-search-tooltip-portal";
import type { SearchDialogBrowsePreviewItem } from "@/lib/use-search-dialog-browse-preview";

/** Figma search hits: 5× ~144px posters, 10px gutter, 10px corners. */
export const SEARCH_DIALOG_POSTER_GRID_CLASS =
	"grid grid-cols-3 gap-2.5 sm:grid-cols-4 min-[44rem]:grid-cols-5";

/**
 * Wrapping poster grid for typed catalogue search (not the empty-state rail).
 */
export function SearchDialogPosterGrid({
	items,
	loading,
	onPick,
	label = "Titles",
	keyboardFocusedIndex = null,
}: {
	items: SearchDialogPosterRailItem[] | SearchDialogBrowsePreviewItem[];
	loading?: boolean;
	onPick: (item: SearchDialogPosterRailItem) => void;
	label?: string;
	keyboardFocusedIndex?: number | null;
}) {
	const gridRef = useRef<HTMLUListElement>(null);

	useEffect(() => {
		if (keyboardFocusedIndex == null || !gridRef.current) return;
		const target = gridRef.current.querySelector<HTMLElement>(
			`[data-search-dialog-result-index="${keyboardFocusedIndex}"]`,
		);
		target?.scrollIntoView({ block: "nearest", inline: "nearest" });
	}, [keyboardFocusedIndex]);

	if (!loading && items.length === 0) return null;

	return (
		<SearchDialogRailTooltipProvider>
			<ul
				ref={gridRef}
				aria-label={label}
				className={SEARCH_DIALOG_POSTER_GRID_CLASS}
			>
				{loading && items.length === 0 ? (
					<SearchDialogPosterGridSkeleton />
				) : null}
				{items.map((item, index) => (
					<li
						key={`${item.listingKind}-${item.id}`}
						className="min-w-0 list-none"
					>
						<Tooltip>
							<TooltipTrigger
								render={
									<SearchDialogKeyboardFocusWrap
										focused={keyboardFocusedIndex === index}
										className="min-w-0 rounded-[10px]"
									>
										<button
											type="button"
											data-search-dialog-result-index={index}
											aria-label={item.title}
											className="w-full min-w-0 cursor-pointer rounded-[10px] text-left outline-none"
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
												frameClassName="rounded-[10px]"
											/>
										</button>
									</SearchDialogKeyboardFocusWrap>
								}
							/>
							<CatalogSearchTooltipContent side="top">
								{item.title}
							</CatalogSearchTooltipContent>
						</Tooltip>
					</li>
				))}
			</ul>
		</SearchDialogRailTooltipProvider>
	);
}
