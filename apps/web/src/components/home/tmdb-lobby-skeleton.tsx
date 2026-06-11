"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import {
	LobbyCatalogChipFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { HomeLobbyFilterRow } from "@/components/home/home-lobby-filter-row";
import { HOME_LOBBY_CATALOGUE_GRID_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

const TMDB_LOBBY_POSTER_SKELETON_KEYS = [
	"p01",
	"p02",
	"p03",
	"p04",
	"p05",
	"p06",
	"p07",
	"p08",
	"p09",
	"p10",
	"p11",
	"p12",
] as const;

/**
 * Placeholder while the Movies/TV catalogue RSC payload loads after leaving Community.
 */
export function TmdbLobbySkeleton() {
	return (
		<div
			className="flex min-h-0 flex-1 flex-col gap-2.5"
			aria-busy
			aria-live="polite"
		>
			<p className="sr-only">Loading catalogue…</p>
			<HomeLobbyFilterRow
				leading={<LobbyCatalogChipFallback />}
				trailing={<LobbyVenueChipFallback />}
			/>
			<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}>
				{TMDB_LOBBY_POSTER_SKELETON_KEYS.map((posterKey) => (
					<ShimmerBone
						key={`tmdb-lobby-skel-poster-${posterKey}`}
						className="aspect-2/3 w-full rounded-[3rem] bg-background"
						aria-hidden
					/>
				))}
			</div>
		</div>
	);
}
