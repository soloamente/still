"use client";

import { useCallback } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

/**
 * Client boundary for `/watchlist` — `PopularMoviesInfinite` needs `getPosterCellKey`, which cannot
 * be passed from a Server Component as a function prop (same pattern as `DiaryLobbyCatalogue`).
 */
export function WatchlistLobbyCatalogue({
	seeds,
	posterCellKeys,
	catalogueWaveKeyOverride,
	monochromePeersOnHover,
	signedIn = false,
}: {
	seeds: PopularMovieSeed[];
	posterCellKeys: string[];
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover: boolean;
	signedIn?: boolean;
}) {
	const getPosterCellKey = useCallback(
		(_movie: PopularMovieSeed, index: number) =>
			posterCellKeys[index] ?? `watchlist-${index}`,
		[posterCellKeys],
	);

	return (
		<PopularMoviesInfinite
			blockedReason={null}
			catalogueRadialSurface="watchlist"
			signedIn={signedIn}
			catalogKind="popular"
			catalogLabel="watchlist"
			catalogMedia="movie"
			catalogueWaveKeyOverride={catalogueWaveKeyOverride}
			getPosterCellKey={getPosterCellKey}
			gridClassName={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}
			monochromePeersOnHover={monochromePeersOnHover}
			posterFrameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
			posterHoverEffect="elevation"
			posterLinkClassName={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
			seedMovies={seeds}
			seedPage={1}
			showTitle={false}
			staggerPosterEntrance
			staticCatalogue
			totalPages={1}
			totalResults={seeds.length}
		/>
	);
}
