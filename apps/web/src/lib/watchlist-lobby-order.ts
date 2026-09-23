/**
 * URL + sort helpers for `/watchlist` lobby — mirrors `diary-lobby-order` so the page can reuse
 * `HomeStickyChrome`, `HomeCatalogViewModeToolbar`, and the same poster grid stack as `/home`.
 */
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import type { TvWatchBundle } from "@/lib/tv-watch-types";
import { formatWatchlistStreamingPill } from "@/lib/watchlist-streaming-display";

export type WatchlistLobbyOrder =
	| "tonight"
	| "available"
	| "continue"
	| "latest_added"
	| "earliest_added"
	| "title_az";

const DEFAULT_ORDER: WatchlistLobbyOrder = "latest_added";

/** Every accepted `?order=` value — unknown values fall back to `DEFAULT_ORDER`. */
const WATCHLIST_LOBBY_ORDERS: readonly WatchlistLobbyOrder[] = [
	"tonight",
	"available",
	"continue",
	"latest_added",
	"earliest_added",
	"title_az",
];

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
	/** Watch tonight — strongest ranking signal as a short pill (e.g. `Maya recommended`). */
	tonight_reason?: string | null;
	/** Patron asked to be alerted when this title starts streaming in their region. */
	streaming_alert?: boolean;
	/** Region the patron chose (ISO alpha-2); `null` when unset — no US guess. */
	streaming_region?: string | null;
	/** Streams on a subscription service in `streaming_region`; `null` without one. */
	streaming_in_region?: boolean | null;
};

export type WatchlistLobbyRowWithListing =
	| (WatchlistLobbyRow & { movie: NonNullable<WatchlistLobbyRow["movie"]> })
	| (WatchlistLobbyRow & { tv: NonNullable<WatchlistLobbyRow["tv"]> });

/** @deprecated Use `WatchlistLobbyRowWithListing`. */
export type WatchlistLobbyRowWithMovie = WatchlistLobbyRowWithListing;

export function parseWatchlistLobbyOrder(
	raw: string | null | undefined,
): WatchlistLobbyOrder {
	return WATCHLIST_LOBBY_ORDERS.find((order) => order === raw) ?? DEFAULT_ORDER;
}

export function buildWatchlistLobbyHref(opts: {
	order: WatchlistLobbyOrder;
}): string {
	if (opts.order === DEFAULT_ORDER) return "/watchlist";
	const params = new URLSearchParams();
	params.set("order", opts.order);
	return `/watchlist?${params.toString()}`;
}

/**
 * Presence/reset key for the watchlist poster wall. Must follow the **RSC seed
 * order** (the sort that fetched page 1), not the optimistic chip value — wiring
 * the chip into this key remounts the grid onto stale seeds before the new
 * payload arrives (double paint: old order, then the real one).
 */
export function watchlistCatalogueWaveKey(order: WatchlistLobbyOrder): string {
	return `watchlist:${order}`;
}

/**
 * True when the chip has moved on but the RSC poster wall still belongs to the
 * previous sort. Used to keep the shimmer up so we never unhide stale tiles.
 */
export function watchlistOrderGridIsStale(
	chipOrder: WatchlistLobbyOrder,
	seedOrder: WatchlistLobbyOrder | null,
): boolean {
	return seedOrder !== null && seedOrder !== chipOrder;
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
		poster_url = tmdbPosterUrlFromPath(poster_url, "w342");
	}
	return {
		id: listing.tmdbId,
		title: listing.title,
		poster_url,
		listingKind: row.tv != null ? "tv" : "movie",
		// Watch tonight's reason pill owns the caption slot; streaming pill otherwise.
		watchlistStreamingLabel:
			row.tonight_reason ??
			(row.streaming_provider_name
				? formatWatchlistStreamingPill(row.streaming_provider_name)
				: null),
		watchlistStreamingAlert: row.streaming_alert === true,
		// Alerts only fire for the chosen region — without one the state is
		// unknown (`undefined` hides the alert slot), never the US-fallback pill.
		watchlistIsStreaming: row.streaming_region
			? (row.streaming_in_region ?? undefined)
			: undefined,
		watchlistStreamingRegion: row.streaming_region ?? null,
	};
}

/** Continue watching seed plus the fields `sortContinueSeeds` orders by. */
export type ContinueWatchingSeed = PopularMovieSeed & {
	/** Next episode has already aired (on or before `todayYmd`). */
	hasNewEpisode: boolean;
	/** `tv_watch.statusChangedAt` — most recently touched shows sort first. */
	changedAt: string;
};

/**
 * Continue watching tile (from `GET /api/tv-watch/me`, never `/api/watchlist`) —
 * the pill names the next episode; aired ones sort first.
 */
export function tvWatchBundleToContinueSeed(
	bundle: TvWatchBundle,
	todayYmd: string,
): ContinueWatchingSeed | null {
	const show = bundle.show;
	if (!show) return null;
	const next = bundle.nextEpisode;
	const posterPath = show.posterPath;
	return {
		id: show.tmdbId,
		title: show.title,
		poster_url:
			posterPath && !posterPath.startsWith("http")
				? tmdbPosterUrlFromPath(posterPath, "w342")
				: posterPath,
		listingKind: "tv",
		watchlistStreamingLabel: next
			? `S${next.seasonNumber} · E${next.episodeNumber} next`
			: "Continue",
		hasNewEpisode: isAiredOnOrBefore(next?.airDate, todayYmd),
		// Eden may deserialize timestamps as `Date` — normalize to an ISO string for sorting.
		changedAt: timestampToIso(bundle.watch?.statusChangedAt),
	};
}

/** True when an episode air date (string or Eden `Date`) is on or before `todayYmd`. */
function isAiredOnOrBefore(raw: unknown, todayYmd: string): boolean {
	const iso = timestampToIso(raw);
	return iso !== "" && iso.slice(0, 10) <= todayYmd;
}

/**
 * Eden deserializes date-like JSON strings into `Date` at runtime even when the
 * type says `string` — accept both; invalid dates become "" (never throw).
 */
function timestampToIso(raw: unknown): string {
	if (typeof raw === "string") return raw;
	if (raw instanceof Date) {
		return Number.isNaN(raw.getTime()) ? "" : raw.toISOString();
	}
	return "";
}

/** New-episode shows first, then most recently changed. */
export function sortContinueSeeds<
	T extends { hasNewEpisode: boolean; changedAt: string },
>(seeds: T[]): T[] {
	return [...seeds].sort((a, b) => {
		if (a.hasNewEpisode !== b.hasNewEpisode) return a.hasNewEpisode ? -1 : 1;
		return b.changedAt.localeCompare(a.changedAt);
	});
}
