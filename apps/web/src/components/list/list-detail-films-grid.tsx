"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";
import { ListDetailPosterTile } from "@/components/list/list-detail-poster-tile";
import { ListItemNoteControl } from "@/components/list/list-item-note-control";
import { ListItemNoteDisplay } from "@/components/list/list-item-note-display";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
	LIST_DETAIL_FILMS_GRID_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import {
	patronLogPosterCaption,
	rankedListPosterLabels,
} from "@/lib/patron-log-poster-caption";
import { profilePosterUrlFromPath } from "@/lib/profile-filmography-map";

export type ListDetailFilmRow = {
	item: {
		id: string;
		position: number;
		note: string | null;
		movieId: number | null;
		tvId?: number | null;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	tv?: { tmdbId: number; title: string; posterPath: string | null } | null;
	ownerLog?: { rating: number | null; liked: boolean } | null;
};

/**
 * List films grid — poster wall with optional ranked index and per-title notes (SN.10).
 */
export function ListDetailFilmsGrid({
	items,
	isRanked,
	listId,
	systemKind = null,
	viewerCanEdit = false,
	canEditNotes = false,
	onMembershipRemoved,
}: {
	items: ListDetailFilmRow[];
	isRanked: boolean;
	listId: string;
	systemKind?: string | null;
	viewerCanEdit?: boolean;
	canEditNotes?: boolean;
	onMembershipRemoved?: (itemId: string) => void;
}) {
	if (items.length === 0) {
		return (
			<div className="rounded-2xl bg-muted/25 p-8 text-center" role="status">
				<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
					No titles yet
				</p>
				<p className="mx-auto mt-2 max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
					Open a film and use{" "}
					<strong className="text-foreground">Add to list</strong> to fill this
					collection.
				</p>
				<Link
					href="/home"
					className={cn(
						buttonVariants({ variant: "outline", size: "pill" }),
						"mt-6 inline-flex",
					)}
				>
					Browse films and shows
				</Link>
			</div>
		);
	}

	return (
		<div
			className={cn(
				LIST_DETAIL_FILMS_GRID_CLASSNAME,
				HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
			)}
		>
			{items.map((row, index) => {
				const listing = row.movie ?? row.tv;
				if (!listing) return null;
				const note = row.item.note?.trim() ?? "";
				const detailHref = row.movie
					? `/movies/${listing.tmdbId}`
					: `/tv/${listing.tmdbId}`;
				const scoreCaption = patronLogPosterCaption({
					rating: row.ownerLog?.rating,
					liked: row.ownerLog?.liked,
				});
				const posterLabels = isRanked
					? rankedListPosterLabels(index, row.ownerLog)
					: { posterCaption: scoreCaption, posterCaptionSubline: undefined };
				return (
					<div
						key={
							row.movie
								? `m:${row.movie.tmdbId}`
								: `t:${row.tv?.tmdbId ?? index}`
						}
						className="relative min-w-0"
					>
						<ListDetailPosterTile
							className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
							frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
							hoverEffect="elevation"
							itemId={row.item.id}
							listId={listId}
							listingKind={row.movie ? "movie" : "tv"}
							onMembershipRemoved={onMembershipRemoved}
							posterCaption={posterLabels.posterCaption}
							posterCaptionSubline={posterLabels.posterCaptionSubline}
							posterUrl={profilePosterUrlFromPath(listing.posterPath)}
							priority={index < 6}
							systemKind={systemKind}
							title={listing.title}
							tmdbId={listing.tmdbId}
							viewerCanEdit={viewerCanEdit}
						/>
						<div className="mt-2 px-0.5">
							<Link
								href={detailHref}
								className="line-clamp-2 text-center font-medium text-foreground text-sm leading-snug hover:text-desert-orange"
							>
								{listing.title}
							</Link>
							{canEditNotes && listId ? (
								<ListItemNoteControl
									listId={listId}
									itemId={row.item.id}
									initialNote={row.item.note}
									titleLabel={listing.title}
								/>
							) : note ? (
								<ListItemNoteDisplay
									note={note}
									className="mt-1"
									lineClamp={4}
								/>
							) : null}
						</div>
					</div>
				);
			})}
		</div>
	);
}
