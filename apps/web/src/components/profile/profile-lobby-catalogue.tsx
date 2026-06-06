"use client";

import { useCallback } from "react";

import {
	type PopularMovieSeed,
	PopularMoviesInfinite,
} from "@/components/movie/popular-movies-infinite";
import { ProfileFilmographyPosterTile } from "@/components/profile/profile-filmography-poster-tile";
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
	isOwnProfile = false,
}: {
	handle: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover?: boolean;
	isOwnProfile?: boolean;
}) {
	const cellKey = useCallback(
		(m: PopularMovieSeed) =>
			m.patronLogId
				? `${m.listingKind ?? "movie"}:log:${m.patronLogId}`
				: `${m.listingKind ?? "movie"}:${m.id}`,
		[],
	);
	const loadPage = useCallback(
		(page: number) => fetchProfileFilmography(handle, page, query),
		[handle, query],
	);

	const renderPoster = useCallback(
		(m: PopularMovieSeed, index: number) => (
			<ProfileFilmographyPosterTile
				className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
				frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
				hoverEffect="elevation"
				listingKind={m.listingKind ?? "movie"}
				patronLogId={isOwnProfile ? m.patronLogId : undefined}
				patronLogLiked={isOwnProfile ? m.patronLogLiked : undefined}
				posterCaption={m.scopeLabel}
				posterUrl={m.poster_url}
				priority={index < 6}
				title={m.title}
				tmdbId={m.id}
			/>
		),
		[isOwnProfile],
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
			renderPoster={renderPoster}
			seedMovies={seeds}
			seedPage={1}
			showTitle={false}
			staggerPosterEntrance
			totalPages={totalPages}
			totalResults={totalResults}
		/>
	);
}
