"use client";

import { cn } from "@still/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { SearchDialogGenreIcon } from "@/components/home/search-dialog-genre-icon";
import { SearchDialogHorizontalRail } from "@/components/home/search-dialog-horizontal-rail";
import { SearchDialogGenreRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import type { SearchDialogGenreRailItem } from "@/lib/search-dialog-featured-genres";
import { buildSearchDialogGenreRailItems } from "@/lib/search-dialog-featured-genres";
import { searchDialogKeyboardFocusActive } from "@/lib/search-dialog-keyboard-focus";
import {
	SEARCH_DIALOG_RAIL_ENTER_ANIMATE,
	SEARCH_DIALOG_RAIL_ENTER_TRANSITION,
	searchDialogRailEnterInitial,
} from "@/lib/search-dialog-tab-pane-motion";
import type { SearchDialogGenre, SearchTag } from "@/lib/search-query-tags";

const GENRE_CHIP_CLASS =
	"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-card py-1.5 pr-2.5 pl-2 font-medium text-[12px] text-foreground transition-colors duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:hover:bg-foreground/10";

function isGenreSelected(
	item: SearchDialogGenreRailItem,
	selectedTags: SearchTag[],
): boolean {
	if (item.kind === "curated") {
		return selectedTags.some(
			(tag) => tag.kind === "curated" && tag.slug === item.slug,
		);
	}
	return selectedTags.some(
		(tag) =>
			tag.kind === "genre" &&
			tag.id === item.id &&
			tag.listingKind === item.listingKind,
	);
}

/**
 * Horizontal genre chips with leading icons — Figma empty-state rail under studios.
 */
export function SearchDialogGenreRail({
	genres,
	listingKind,
	selectedTags,
	onSelect,
	loading,
	keyboardFocusedIndex = null,
	resultIndexBase = 0,
}: {
	genres: SearchDialogGenre[];
	listingKind: "movie" | "tv";
	selectedTags: SearchTag[];
	onSelect: (item: SearchDialogGenreRailItem) => void;
	loading?: boolean;
	keyboardFocusedIndex?: number | null;
	resultIndexBase?: number;
}) {
	const reduceMotion = useReducedMotion();
	const items = buildSearchDialogGenreRailItems(genres, listingKind);
	if (!loading && items.length === 0) return null;

	const contentKey = [
		loading ? "loading" : "ready",
		listingKind,
		items
			.map((item) => (item.kind === "curated" ? item.slug : `genre-${item.id}`))
			.join(","),
	].join("\0");

	return (
		<SearchDialogHorizontalRail
			label="Filter by genre"
			contentKey={contentKey}
			enabled={loading || items.length > 0}
			gapClassName="gap-[5px]"
		>
			{loading ? (
				<SearchDialogGenreRailSkeleton />
			) : (
				<motion.div
					key={listingKind}
					className="flex shrink-0 items-center gap-[5px]"
					initial={searchDialogRailEnterInitial(reduceMotion)}
					animate={SEARCH_DIALOG_RAIL_ENTER_ANIMATE}
					transition={SEARCH_DIALOG_RAIL_ENTER_TRANSITION}
				>
					{items.map((item, index) => {
						const resultIndex = resultIndexBase + index;
						const keyboardFocused = keyboardFocusedIndex === resultIndex;
						const selected = isGenreSelected(item, selectedTags);
						const label = item.kind === "curated" ? item.label : item.name;
						return (
							<button
								key={item.kind === "curated" ? item.slug : `genre-${item.id}`}
								type="button"
								data-search-dialog-result-index={resultIndex}
								aria-pressed={selected}
								onClick={() => onSelect(item)}
								className={cn(
									GENRE_CHIP_CLASS,
									"t-avatar relative z-0 [@media(hover:hover)]:hover:z-[1]",
									selected && !keyboardFocused && "bg-foreground/12",
									searchDialogKeyboardFocusActive(keyboardFocused),
								)}
							>
								<SearchDialogGenreIcon name={label} />
								<span className="whitespace-nowrap">{label}</span>
							</button>
						);
					})}
				</motion.div>
			)}
		</SearchDialogHorizontalRail>
	);
}
