"use client";

import { buttonVariants } from "@still/ui/components/button";
import Link from "next/link";
import { useCallback } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import { useWatchlistLobbyParams } from "@/components/watchlist/watchlist-lobby-params-context";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { fetchMyWatchlist } from "@/lib/still-api-fetch";

/**
 * Client boundary for the `/watchlist` poster wall — seeds page 1 (server-rendered)
 * and pages the personal list on scroll via `fetchMyWatchlist` (see `loadPage`).
 */
export function WatchlistLobbyCatalogue({
	seeds,
	totalPages,
	totalResults,
	monochromePeersOnHover,
	signedIn = false,
}: {
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	monochromePeersOnHover: boolean;
	signedIn?: boolean;
}) {
	const { order } = useWatchlistLobbyParams();

	// Stable, media-aware key — used for both React cell keys and cross-page dedupe.
	const cellKey = useCallback(
		(m: PopularMovieSeed) => `${m.listingKind ?? "movie"}:${m.id}`,
		[],
	);

	const loadPage = useCallback(
		(page: number, signal?: AbortSignal) =>
			fetchMyWatchlist(page, { order, signal }),
		[order],
	);

	if (seeds.length === 0) {
		return (
			<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 py-6 sm:px-4 sm:py-10">
				<div
					className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-border border-dashed bg-card/40 px-6 py-12 text-center sm:px-10 sm:py-14"
					role="status"
				>
					<div className="space-y-2">
						<p className="font-sans font-semibold text-foreground text-lg tracking-tight">
							Your watchlist is empty
						</p>
						<p className="text-muted-foreground text-sm leading-relaxed">
							When something catches your eye, open its page and tap{" "}
							<strong className="text-foreground">Watchlist</strong> — it will
							show up in this lobby wall.
						</p>
					</div>
					<Link
						href="/home"
						className={buttonVariants({ variant: "outline", size: "pill" })}
					>
						Search films and shows
					</Link>
				</div>
			</div>
		);
	}

	return (
		<PopularMoviesInfinite
			blockedReason={null}
			catalogueRadialSurface="watchlist"
			signedIn={signedIn}
			catalogMedia="movie"
			catalogExhaustedScope="your watchlist"
			catalogueWaveKeyOverride={`watchlist:${order}`}
			getPosterCellKey={cellKey}
			getDedupeKey={cellKey}
			loadPage={loadPage}
			gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
			monochromePeersOnHover={monochromePeersOnHover}
			posterFrameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
			posterHoverEffect="elevation"
			posterLinkClassName={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
			seedMovies={seeds}
			seedPage={1}
			showTitle={false}
			staggerPosterEntrance
			totalPages={totalPages}
			totalResults={totalResults}
		/>
	);
}
