import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import { cn } from "@still/ui/lib/utils";

import {
	LobbyCatalogChipFallback,
	LobbyStickyChromeFallback,
	LobbyVenueChipFallback,
} from "@/components/app/lobby-suspense-fallbacks";
import { HomeLobbyFilterRow } from "@/components/home/home-lobby-filter-row";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";

/** Stable keys for the static poster placeholders (not list data — avoids index keys). */
const LOBBY_POSTER_KEYS = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
] as const;

/** Poster-wall shimmer shared by every lobby loader (and the watchlist in-page fallback). */
export function LobbyPosterGridFallback() {
	return (
		<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME} aria-hidden>
			{LOBBY_POSTER_KEYS.map((key) => (
				<ShimmerBone
					key={key}
					className="aspect-[2/3] w-full rounded-xl bg-card/60"
				/>
			))}
		</div>
	);
}

/**
 * Route-level skeleton for the catalogue lobbies (`/home`, `/diary`, `/lists`). Mirrors
 * the shared lobby structure — sticky header → control row → poster grid — so navigation
 * shows one layout-matching loader instead of the generic `(app)/loading.tsx` skeleton.
 * The header shimmer reserves the chrome height so content doesn't shift in when it lands.
 */
export function LobbyCatalogueLoading() {
	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<LobbyStickyChromeFallback />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"overflow-visible",
				)}
			>
				<HomeLobbyFilterRow
					leading={<LobbyCatalogChipFallback />}
					trailing={<LobbyVenueChipFallback />}
				/>
				<LobbyPosterGridFallback />
			</section>
		</div>
	);
}
