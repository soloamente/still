"use client";

import { cn } from "@still/ui/lib/utils";

import { CataloguePosterGroup } from "@/components/catalogue/catalogue-poster-group";
import { ListLobbyPoster } from "@/components/list/list-lobby-poster";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";

/**
 * `/lists` poster wall — mirrors `WatchlistLobbyCatalogue` / `PopularMoviesInfinite` static mode.
 * Order changes are frequent, so tiles paint immediately instead of fading in.
 */
export function ListsLobbyCatalogue({
	seeds,
	monochromePeersOnHover,
}: {
	seeds: ListLobbySeed[];
	monochromePeersOnHover: boolean;
}) {
	return (
		<CataloguePosterGroup
			className={cn(
				HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
				monochromePeersOnHover &&
					HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
			)}
		>
			{seeds.map((list, index) => (
				<ListLobbyPoster
					key={list.id}
					list={list}
					priority={index < 6}
					className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
					frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
				/>
			))}
		</CataloguePosterGroup>
	);
}
