/**
 * URL + sort helpers for `/watchlist` lobby — mirrors `diary-lobby-order` so the page can reuse
 * `HomeStickyChrome`, `HomeCatalogViewModeToolbar`, and the same poster grid stack as `/home`.
 */
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { tmdbPosterUrlFromPath } from "@/lib/tmdb-poster-url";
import type { TvWatchBundle } from "@/lib/tv-watch-types";
import {
	formatWatchlistProviderQuery,
	parseWatchlistProviderIds,
} from "@/lib/watchlist-provider-filter";
import { formatWatchlistStreamingPill } from "@/lib/watchlist-streaming-display";
import type { WatchlistReasonKind } from "@/lib/watchlist-tile-analytics";

/** Grid sort chips on `/watchlist` — hero/continue use separate data paths. */
export type WatchlistLobbyOrder =
	| "latest_added"
	| "earliest_added"
	| "title_az";

/** Legacy `?order=` values redirected at the page boundary (hero-platforms IA). */
export type WatchlistLegacyLobbyOrder = "tonight" | "available" | "continue";

/** Poster scrim modes — includes legacy sorts still used by hero prefetch/tests. */
export type WatchlistPosterCaptionMode =
	| WatchlistLobbyOrder
	| WatchlistLegacyLobbyOrder;

const DEFAULT_ORDER: WatchlistLobbyOrder = "latest_added";

/** Every accepted `?order=` value — unknown values fall back to `DEFAULT_ORDER`. */
const WATCHLIST_LOBBY_ORDERS: readonly WatchlistLobbyOrder[] = [
	"latest_added",
	"earliest_added",
	"title_az",
];

const WATCHLIST_LEGACY_LOBBY_ORDERS: readonly WatchlistLegacyLobbyOrder[] = [
	"tonight",
	"available",
	"continue",
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
	/** Enum bucket behind `tonight_reason` — the only reason value analytics may send. */
	tonight_reason_kind?: WatchlistReasonKind | null;
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

export function isWatchlistLegacyLobbyOrder(
	raw: string | null | undefined,
): raw is WatchlistLegacyLobbyOrder {
	return (
		raw != null &&
		(WATCHLIST_LEGACY_LOBBY_ORDERS as readonly string[]).includes(raw)
	);
}

export function parseWatchlistLobbyOrder(
	raw: string | null | undefined,
): WatchlistLobbyOrder {
	if (isWatchlistLegacyLobbyOrder(raw)) return DEFAULT_ORDER;
	return WATCHLIST_LOBBY_ORDERS.find((order) => order === raw) ?? DEFAULT_ORDER;
}

function watchlistSearchParamFirst(
	raw: string | string[] | undefined,
): string | undefined {
	return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * When old decision-engine URLs land, strip legacy `order` and map
 * `available` → `?filters=1` (popover opens in Task 6).
 */
export function resolveWatchlistLegacyRedirect(sp: {
	order?: string | string[];
	providers?: string | string[];
}): string | null {
	const order = watchlistSearchParamFirst(sp.order);
	if (!isWatchlistLegacyLobbyOrder(order)) return null;

	const params = new URLSearchParams();
	const providersRaw = watchlistSearchParamFirst(sp.providers);
	const providers = parseWatchlistProviderIds(providersRaw);
	if (providers.length > 0) {
		params.set("providers", formatWatchlistProviderQuery(providers));
	}
	if (order === "available") params.set("filters", "1");

	const query = params.toString();
	return query ? `/watchlist?${query}` : "/watchlist";
}

export function buildWatchlistLobbyHref(opts: {
	order?: WatchlistLobbyOrder;
	providers?: readonly number[];
	/** One-shot open for filters popover (`?filters=1`). */
	filters?: boolean;
}): string {
	const order = opts.order ?? DEFAULT_ORDER;
	const params = new URLSearchParams();
	if (order !== DEFAULT_ORDER) params.set("order", order);
	const providers = opts.providers ?? [];
	if (providers.length > 0) {
		params.set("providers", formatWatchlistProviderQuery(providers));
	}
	if (opts.filters) params.set("filters", "1");
	const query = params.toString();
	return query ? `/watchlist?${query}` : "/watchlist";
}

/**
 * Presence/reset key for the watchlist poster wall. Must follow the **RSC seed
 * order** (the sort that fetched page 1), not the optimistic chip value — wiring
 * the chip into this key remounts the grid onto stale seeds before the new
 * payload arrives (double paint: old order, then the real one).
 */
export function watchlistCatalogueWaveKey(
	order: WatchlistLobbyOrder,
	providers: readonly number[] = [],
): string {
	const providerKey =
		providers.length > 0 ? formatWatchlistProviderQuery(providers) : "";
	return providerKey
		? `watchlist:${order}:${providerKey}`
		: `watchlist:${order}`;
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

/** Poster scrim copy depends on the active mode — not every sort is a streaming view. */
function watchlistPosterCaptionForOrder(
	row: WatchlistLobbyRowWithListing,
	order: WatchlistPosterCaptionMode,
): string | null {
	const listing = row.movie ?? row.tv;
	if (!listing) return null;
	switch (order) {
		case "tonight":
			// Only the ranked reason — no fallback streaming noise on every tile.
			return row.tonight_reason ?? null;
		case "available":
			return row.streaming_provider_name
				? formatWatchlistStreamingPill(row.streaming_provider_name)
				: null;
		case "continue":
			return null;
		case "latest_added":
		case "earliest_added":
		case "title_az":
			// Library-style wall: title on the scrim, like `/lists`.
			return listing.title;
		default: {
			const unreachable: never = order;
			return unreachable;
		}
	}
}

const TONIGHT_RANK_SUBLINE = ["Top pick", "2nd pick", "3rd pick"] as const;

/** Adds tonight rank sublines on the first three ranked tiles (page 1 only). */
export function decorateWatchlistSeedsForMode(
	seeds: PopularMovieSeed[],
	order: WatchlistPosterCaptionMode,
): PopularMovieSeed[] {
	if (order !== "tonight") return seeds;
	return seeds.map((seed, index) => {
		const subline = TONIGHT_RANK_SUBLINE[index];
		if (!subline) return seed;
		return { ...seed, watchlistCaptionSubline: subline };
	});
}

/** Map a joined watchlist row to the poster seed shape the lobby grid renders. */
export function watchlistRowToPopularSeed(
	row: WatchlistLobbyRowWithListing,
	order: WatchlistPosterCaptionMode = "latest_added",
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
		watchlistStreamingLabel: watchlistPosterCaptionForOrder(row, order),
		watchlistStreamingAlert: row.streaming_alert === true,
		// Alerts only fire for the chosen region — without one the state is
		// unknown (`undefined` hides the alert slot), never the US-fallback pill.
		watchlistIsStreaming: row.streaming_region
			? (row.streaming_in_region ?? undefined)
			: undefined,
		watchlistStreamingRegion: row.streaming_region ?? null,
		watchlistReasonKind: row.tonight_reason_kind ?? null,
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
		watchlistStreamingLabel: continueEpisodeLabel(next, todayYmd),
		hasNewEpisode: isAiredOnOrBefore(next?.airDate, todayYmd),
		// Eden may deserialize timestamps as `Date` — normalize to an ISO string for sorting.
		changedAt: timestampToIso(bundle.watch?.statusChangedAt),
	};
}

/** `Oct 3` — UTC so a `YYYY-MM-DD` air date never shifts a day by viewer timezone. */
const SHORT_AIR_DATE = new Intl.DateTimeFormat("en", {
	month: "short",
	day: "numeric",
	timeZone: "UTC",
});

/**
 * Continue watching pill: aired → `S2 · E5 next`; announced → `S2 · E5 · Oct 3`;
 * no next-episode data → `null` (no pill — never a vague "Continue").
 */
function continueEpisodeLabel(
	next: TvWatchBundle["nextEpisode"],
	todayYmd: string,
): string | null {
	if (!next) return null;
	const episode = `S${next.seasonNumber} · E${next.episodeNumber}`;
	const iso = timestampToIso(next.airDate);
	const airYmd = iso.slice(0, 10);
	if (iso === "" || airYmd <= todayYmd) return `${episode} next`;
	const airDate = new Date(`${airYmd}T00:00:00Z`);
	if (Number.isNaN(airDate.getTime())) return `${episode} next`;
	return `${episode} · ${SHORT_AIR_DATE.format(airDate)}`;
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
