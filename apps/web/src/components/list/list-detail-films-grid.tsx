"use client";

import { buttonVariants } from "@still/ui/components/button";
import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

import { MoviePoster } from "@/components/movie/movie-poster";
import {
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
	LIST_DETAIL_FILMS_GRID_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
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
};

/**
 * List films grid — same chrome as movie detail {@link RelatedMoviesPosterGrid}.
 */
export function ListDetailFilmsGrid({
	items,
	isRanked,
}: {
	items: ListDetailFilmRow[];
	isRanked: boolean;
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
				return (
					<div
						key={
							row.movie
								? `m:${row.movie.tmdbId}`
								: `t:${row.tv?.tmdbId ?? index}`
						}
						className="relative min-w-0"
					>
						<MoviePoster
							movieId={listing.tmdbId}
							title={listing.title}
							posterUrl={profilePosterUrlFromPath(listing.posterPath)}
							listingKind={row.movie ? "movie" : "tv"}
							priority={index < 6}
							showTitle={false}
							hoverEffect="elevation"
							className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
							frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
						/>
						{isRanked ? (
							<div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t from-card/95 via-card/50 to-transparent px-2 pt-8 pb-2.5">
								<span className="font-medium text-foreground text-sm tabular-nums tracking-tight">
									{index + 1}
								</span>
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
