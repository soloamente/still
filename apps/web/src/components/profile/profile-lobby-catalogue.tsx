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
import {
	type FilmographyQueryOpts,
	fetchProfileFilmography,
} from "@/lib/profile-filmography-fetch";

/**
 * Patron filmography grid — seeds page 1 (server-rendered) and pages the personal
 * ledger on scroll via `fetchProfileFilmography` (see `loadPage`).
 */
export function ProfileLobbyCatalogue({
	handle,
	seeds,
	totalPages,
	totalResults,
	query,
	catalogueWaveKeyOverride,
	monochromePeersOnHover = false,
}: {
	handle: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover?: boolean;
}) {
	const cellKey = useCallback(
		(m: PopularMovieSeed) => `${m.listingKind ?? "movie"}:${m.id}`,
		[],
	);
	const loadPage = useCallback(
		(page: number) => fetchProfileFilmography(handle, page, query),
		[handle, query],
	);

	return (
		<PopularMoviesInfinite
			blockedReason={null}
			catalogMedia="movie"
			catalogLabel="profile"
			catalogueWaveKeyOverride={catalogueWaveKeyOverride}
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
