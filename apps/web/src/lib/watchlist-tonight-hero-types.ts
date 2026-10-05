import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import type { WatchlistLobbyRowWithListing } from "@/lib/watchlist-lobby-order";
import type { WatchlistReasonKind } from "@/lib/watchlist-tile-analytics";

/** One ranked save in the Tonight hero rotation pool. */
export type WatchlistTonightHeroPick = {
	listingKind: "movie" | "tv";
	tmdbId: number;
	title: string;
	posterUrl: string | null;
	tonightReason: string | null;
	tonightReasonKind: WatchlistReasonKind | null;
	/** Absolute TMDb logo for the “Now on …” service, when the reason is availability. */
	tonightProviderLogoUrl: string | null;
};

export type WatchlistTonightHeroPayload = {
	pool: WatchlistTonightHeroPick[];
	failed: boolean;
	/** Patron watch region signal from `GET /api/watchlist`. */
	region: string | null | undefined;
};

/** Map a joined watchlist row into a hero pick (media enrichment happens on the client). */
export function watchlistRowToTonightHeroPick(
	row: WatchlistLobbyRowWithListing,
): WatchlistTonightHeroPick {
	const listing = row.movie ?? row.tv;
	if (!listing) {
		throw new Error("watchlistRowToTonightHeroPick: row missing listing");
	}
	const listingKind = row.tv != null ? "tv" : "movie";
	let posterUrl: string | null = listing.posterPath;
	if (posterUrl?.length && !posterUrl.startsWith("http")) {
		posterUrl = tmdbPosterUrlFromPath(posterUrl, "w780");
	}
	return {
		listingKind,
		tmdbId: listing.tmdbId,
		title: listing.title,
		posterUrl,
		tonightReason: row.tonight_reason ?? null,
		tonightReasonKind: row.tonight_reason_kind ?? null,
		tonightProviderLogoUrl: tmdbPosterUrlFromPath(
			row.streaming_provider_logo_path ?? null,
			"w92",
		),
	};
}

export function listingDetailHref(pick: WatchlistTonightHeroPick): string {
	return pick.listingKind === "tv"
		? `/tv/${pick.tmdbId}`
		: `/movies/${pick.tmdbId}`;
}
