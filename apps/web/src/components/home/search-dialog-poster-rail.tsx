"use client";

import { SearchDialogHorizontalRail } from "@/components/home/search-dialog-horizontal-rail";
import { SearchDialogPosterRailSkeleton } from "@/components/home/search-dialog-result-skeletons";
import { MoviePoster } from "@/components/movie/movie-poster";
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
}: {
	items: SearchDialogPosterRailItem[] | SearchDialogBrowsePreviewItem[];
	loading?: boolean;
	onPick: (item: SearchDialogPosterRailItem) => void;
	label?: string;
}) {
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
			) : null}
			{items.map((item) => (
				<button
					key={`${item.listingKind}-${item.id}`}
					type="button"
					className={`${POSTER_TILE_CLASS} cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
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
			))}
		</SearchDialogHorizontalRail>
	);
}
