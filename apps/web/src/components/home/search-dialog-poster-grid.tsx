"use client";

import { SearchDialogPosterGridSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { MoviePoster } from "@/components/movie/movie-poster";
import type { SearchDialogPosterRailItem } from "@/components/home/search-dialog-poster-rail";
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
}: {
	items: SearchDialogPosterRailItem[] | SearchDialogBrowsePreviewItem[];
	loading?: boolean;
	onPick: (item: SearchDialogPosterRailItem) => void;
	label?: string;
}) {
	if (!loading && items.length === 0) return null;

	return (
		<div
			role="list"
			aria-label={label}
			className={SEARCH_DIALOG_POSTER_GRID_CLASS}
		>
			{loading && items.length === 0 ? (
				<SearchDialogPosterGridSkeleton />
			) : null}
			{items.map((item) => (
				<button
					key={`${item.listingKind}-${item.id}`}
					type="button"
					role="listitem"
					className="min-w-0 cursor-pointer rounded-[10px] text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
			))}
		</div>
	);
}
