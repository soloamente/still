/**
 * URL + sort helpers for `/watchlist` lobby — mirrors `diary-lobby-order` so the page can reuse
 * `HomeStickyChrome`, `HomeCatalogViewModeToolbar`, and the same poster grid stack as `/home`.
 */
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { formatWatchlistStreamingPill } from "@/lib/watchlist-streaming-display";

export type WatchlistLobbyOrder =
	| "latest_added"
	| "earliest_added"
	| "title_az";

const DEFAULT_ORDER: WatchlistLobbyOrder = "latest_added";

/** First-page size; mirrors the server `WATCHLIST_DEFAULT_LIMIT`. */
export const WATCHLIST_PAGE_SIZE = 24;

/** Row shape from `GET /api/watchlist` — joined `movie` or `tv` for poster + title. */
export type WatchlistLobbyRow = {
	item: {
		addedAt: string;
		movieId: number | null;
		tvId: number | null;
	};
	movie: { tmdbId: number; title: string; posterPath: string | null } | null;
	tv: { tmdbId: number; title: string; posterPath: string | null } | null;
	/** First flatrate provider in the patron's watch region, when cached on the listing. */
	streaming_provider_name?: string | null;
};

export type WatchlistLobbyRowWithListing =
	| (WatchlistLobbyRow & { movie: NonNullable<WatchlistLobbyRow["movie"]> })
	| (WatchlistLobbyRow & { tv: NonNullable<WatchlistLobbyRow["tv"]> });

/** @deprecated Use `WatchlistLobbyRowWithListing`. */
export type WatchlistLobbyRowWithMovie = WatchlistLobbyRowWithListing;

export function parseWatchlistLobbyOrder(
	raw: string | null | undefined,
): WatchlistLobbyOrder {
	if (
		raw === "latest_added" ||
		raw === "earliest_added" ||
		raw === "title_az"
	) {
		return raw;
	}
	return DEFAULT_ORDER;
}

export function buildWatchlistLobbyHref(opts: {
	order: WatchlistLobbyOrder;
}): string {
	if (opts.order === DEFAULT_ORDER) return "/watchlist";
	const params = new URLSearchParams();
	params.set("order", opts.order);
	return `/watchlist?${params.toString()}`;
}

export function isWatchlistRowWithListing(
	row: WatchlistLobbyRow,
): row is WatchlistLobbyRowWithListing {
	return row.movie != null || row.tv != null;
}

/** @deprecated Use `isWatchlistRowWithListing`. */
export const isWatchlistRowWithMovie = isWatchlistRowWithListing;

/** Map a joined watchlist row to the poster seed shape the lobby grid renders. */
export function watchlistRowToPopularSeed(
	row: WatchlistLobbyRowWithListing,
): PopularMovieSeed {
	const listing = row.movie ?? row.tv;
	if (!listing) {
		throw new Error("watchlistRowToPopularSeed: row missing movie and tv");
	}
	let poster_url: string | null = listing.posterPath;
	if (poster_url?.length && !poster_url.startsWith("http")) {
		const fragment = poster_url.startsWith("/") ? poster_url : `/${poster_url}`;
		poster_url = `https://image.tmdb.org/t/p/w780${fragment}`;
	}
	return {
		id: listing.tmdbId,
		title: listing.title,
		poster_url,
		listingKind: row.tv != null ? "tv" : "movie",
		watchlistStreamingLabel: row.streaming_provider_name
			? formatWatchlistStreamingPill(row.streaming_provider_name)
			: null,
	};
}
