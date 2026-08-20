"use client";

import IconHeartFilled from "@still/ui/icons/heart-filled";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { ListCoverRail } from "@/components/list/list-cover-rail";

import { COMMUNITY_FEED_META_PILL_CLASS } from "@/lib/community-feed-row-layout";
import { DETAIL_CANVAS_ON_CARD_HOVER_CLASS } from "@/lib/detail-action-motion";
import { formatDistanceToNowStrict } from "@/lib/format";
import type { ListBoardRow } from "@/lib/list-board-row";
import { toListBoardRow } from "@/lib/list-board-row";

/** API row for movie/TV detail community lists (hydrated with `coverPosterPaths`). */
export type MovieListForPageTab = {
	id: string;
	title: string;
	description: string | null;
	itemsCount: number;
	updatedAt: string;
	likesCount: number;
	ownerHandle?: string;
	coverMovieIds?: number[];
	coverPosterPaths?: (string | null)[];
	coverImageUrl?: string | null;
	coverMovieId?: number | null;
};

function movieListToBoardRow(list: MovieListForPageTab): ListBoardRow {
	return toListBoardRow({
		...list,
		coverMovieIds: list.coverMovieIds ?? [],
		coverPosterPaths: list.coverPosterPaths ?? [],
		isPublic: true,
		movieItemsCount: list.itemsCount,
		tvItemsCount: 0,
	});
}

/**
 * Public list row on movie/TV detail **Community → Lists**.
 * Split links (title → list, @handle → profile), poster strip, and meta pills.
 */
export function MovieDetailListTile({
	list,
	countLabel = "titles",
}: {
	list: MovieListForPageTab;
	/** Meta copy — `title` / `titles` for list item count. */
	countLabel?: string;
}) {
	const boardRow = movieListToBoardRow(list);
	const listHref = `/lists/${list.id}`;
	const updatedLabel = formatDistanceToNowStrict(new Date(list.updatedAt));
	// System Favorites used a second-person diary blurb — hide it on public tiles.
	const publicDescription =
		list.description === "Titles you've favorited from your diary."
			? null
			: list.description;

	return (
		<article
			className={cn(
				// Flat canvas-on-card — no decorative shadow (surface depth only).
				"flex min-w-0 items-stretch overflow-hidden rounded-[1.75rem] bg-background",
				"transition-[transform,background-color] duration-150 ease-out motion-reduce:transition-none",
				DETAIL_CANVAS_ON_CARD_HOVER_CLASS,
			)}
		>
			{/* Cover — fixed-width column; never overlaps the copy column. */}
			<Link
				href={listHref}
				className={cn(
					"flex w-[5.75rem] shrink-0 self-stretch py-4 pl-4 sm:w-[7.25rem]",
					"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:active:scale-100",
				)}
				aria-label={`Open list ${list.title}`}
			>
				<ListCoverRail list={boardRow} />
			</Link>

			{/* Copy — title + description up top; meta pills pinned to the tile foot. */}
			<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 self-stretch py-4 pr-4 pl-3 sm:pr-5 sm:pl-4">
				{list.ownerHandle ? (
					<p className="text-muted-foreground text-xs">
						by{" "}
						<Link
							href={`/profile/${list.ownerHandle}`}
							className="font-medium text-foreground/90 transition-colors duration-150 [@media(hover:hover)]:hover:text-desert-orange"
						>
							@{list.ownerHandle}
						</Link>
					</p>
				) : null}

				<Link
					href={listHref}
					className={cn(
						"min-w-0 font-semibold text-foreground text-lg leading-snug tracking-tight sm:text-xl",
						"transition-colors duration-150 [@media(hover:hover)]:hover:text-desert-orange",
					)}
				>
					{list.title}
				</Link>

				{publicDescription ? (
					<p className="line-clamp-2 font-editorial text-foreground/80 text-sm leading-relaxed">
						{publicDescription}
					</p>
				) : null}

				<div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
					<span className={COMMUNITY_FEED_META_PILL_CLASS}>
						<span className="tabular-nums">{list.itemsCount}</span>{" "}
						{list.itemsCount === 1 ? countLabel.replace(/s$/, "") : countLabel}
					</span>
					{list.likesCount > 0 ? (
						<span className={COMMUNITY_FEED_META_PILL_CLASS}>
							<IconHeartFilled
								className="size-3 shrink-0 text-desert-orange"
								aria-hidden
							/>
							<span className="tabular-nums">{list.likesCount}</span>
						</span>
					) : null}
					<span className={COMMUNITY_FEED_META_PILL_CLASS}>
						Updated {updatedLabel} ago
					</span>
				</div>
			</div>
		</article>
	);
}
