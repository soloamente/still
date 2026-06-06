"use client";

import { cn } from "@still/ui/lib/utils";
import { X } from "lucide-react";
import { useRef } from "react";

import {
	filterChipBaseClass,
	filterChipIdleClass,
} from "@/components/ui/filter-chip-row";
import type { RecentSearchEntryV2 } from "@/lib/home-search-recent-storage";
import { useHorizontalScrollFades } from "@/lib/use-horizontal-scroll-fades";

/**
 * Horizontal recent-search chip rail for the catalog search dialog empty state.
 * Left inset matches other dialog rows (`pl-4`); right fade hides the scroll clip.
 */
export function SearchDialogRecentSearches({
	entries,
	headingId,
	onPick,
	onRemove,
}: {
	entries: RecentSearchEntryV2[];
	headingId: string;
	onPick: (entry: RecentSearchEntryV2) => void;
	onRemove: (entry: RecentSearchEntryV2) => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const contentKey = entries.map((entry) => entry.label).join("\0");
	const { showStartFade, showEndFade } = useHorizontalScrollFades(
		scrollRef,
		entries.length > 0,
		contentKey,
	);

	if (entries.length === 0) return null;

	return (
		<div className="shrink-0 pt-1 pb-3">
			<h3 id={headingId} className="sr-only">
				Recent searches
			</h3>
			<div className="relative min-w-0 overflow-hidden">
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card via-card/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showStartFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-card via-card/85 to-transparent transition-opacity duration-200 motion-reduce:transition-none",
						showEndFade ? "opacity-100" : "opacity-0",
					)}
				/>
				<div
					ref={scrollRef}
					role="toolbar"
					aria-labelledby={headingId}
					className="scrollbar-none flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pr-4 pb-0.5 pl-4 [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
				>
					{entries.map((entry) => (
						<RecentSearchChip
							key={entry.label}
							entry={entry}
							onPick={() => onPick(entry)}
							onRemove={() => onRemove(entry)}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function RecentSearchChip({
	entry,
	onPick,
	onRemove,
}: {
	entry: RecentSearchEntryV2;
	onPick: () => void;
	onRemove: () => void;
}) {
	return (
		<span
			className={cn(
				filterChipBaseClass,
				filterChipIdleClass,
				"inline-flex h-8 max-w-64 shrink-0 items-center gap-0.5 py-0 pr-1 pl-3",
			)}
		>
			<button
				type="button"
				onClick={onPick}
				title={`Search for “${entry.label}”`}
				className="min-w-0 flex-1 truncate text-left"
			>
				{entry.label}
			</button>
			<button
				type="button"
				aria-label={`Remove “${entry.label}” from recent searches`}
				className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-out motion-reduce:transition-none [@media(hover:hover)]:hover:bg-foreground/10 [@media(hover:hover)]:hover:text-foreground"
				onClick={(event) => {
					event.stopPropagation();
					onRemove();
				}}
			>
				<X className="size-3.5" aria-hidden />
			</button>
		</span>
	);
}
