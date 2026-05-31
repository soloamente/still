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
import type { PersonFilmographyRow } from "@/lib/person-filmography";

function personRowToSeed(row: PersonFilmographyRow): PopularMovieSeed {
	return {
		id: row.tmdbId,
		title: row.title,
		poster_url: row.posterUrl,
		listingKind: row.mediaKind === "tv" ? "tv" : "movie",
		scopeLabel: row.posterCaption ?? null,
	};
}

/**
 * Patron filmography / favorites grid — `/home` lobby posters with stagger entrance
 * (`PopularMoviesInfinite`, same as `/diary`).
 */
export function ProfileLobbyCatalogue({
	rows,
	posterCellKeys,
	catalogueWaveKeyOverride,
	monochromePeersOnHover = true,
}: {
	rows: PersonFilmographyRow[];
	posterCellKeys: string[];
	catalogueWaveKeyOverride: string;
	monochromePeersOnHover?: boolean;
}) {
	const seeds = rows.map(personRowToSeed);

	const getPosterCellKey = useCallback(
		(_movie: PopularMovieSeed, index: number) =>
			posterCellKeys[index] ?? `profile-${index}`,
		[posterCellKeys],
	);

	return (
		<PopularMoviesInfinite
			blockedReason={null}
			catalogKind="popular"
			catalogLabel="profile"
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
