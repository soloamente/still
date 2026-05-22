import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { HomeVenue } from "@/lib/home-venue";
import { defaultHomeVenueForSort } from "@/lib/home-venue";

/**
 * Canonical query builder for movie discover slices — now targets `/home?browse=movies`
 * instead of the retired `/movies/discover` route.
 */
export const DISCOVER_SORT_DEFAULT = "popularity.desc";

export const DISCOVER_SORT_OPTIONS = [
	{ value: "popularity.desc", label: "Popular" },
	{ value: "primary_release_date.desc", label: "Newest" },
	{ value: "vote_average.desc", label: "Top rated" },
	{ value: "original_title.asc", label: "A–Z title" },
] as const;

export type DiscoverSortValue = (typeof DISCOVER_SORT_OPTIONS)[number]["value"];

const SORT_WHITELIST = new Set<string>(
	DISCOVER_SORT_OPTIONS.map((o) => o.value),
);

/** TMDb discover `with_watch_monetization_types` — keep in sync with server whitelist. */
export const DISCOVER_MONETIZATION_WHITELIST = new Set([
	"flatrate",
	"rent",
	"buy",
	"ads",
	"free",
]);

export function normalizeDiscoverMonetization(
	raw: string | undefined | null,
): string | null {
	const s = raw?.trim().toLowerCase() ?? "";
	return DISCOVER_MONETIZATION_WHITELIST.has(s) ? s : null;
}

export function normalizeDiscoverSort(
	raw: string | undefined | null,
): DiscoverSortValue {
	const s = raw?.trim() ?? "";
	return (
		SORT_WHITELIST.has(s) ? s : DISCOVER_SORT_DEFAULT
	) as DiscoverSortValue;
}

function discoverSortToLobbySort(
	raw: string | null | undefined,
): HomeCatalogSort {
	const s = raw?.trim() ?? "";
	if (s === "primary_release_date.asc") return "upcoming";
	if (s === "primary_release_date.desc") return "latest";
	return "popular";
}

function venueFromDiscoverParts(parts: {
	venue?: HomeVenue | null;
	monetization?: string | null;
	sort: HomeCatalogSort;
}): HomeVenue | undefined {
	if (parts.venue === "theaters" || parts.venue === "streaming") {
		return parts.venue;
	}
	if (normalizeDiscoverMonetization(parts.monetization) === "flatrate") {
		return "streaming";
	}
	return defaultHomeVenueForSort(parts.sort);
}

/** Maps discover filter parts to the matching `/home` movies lobby URL. */
export function discoverPartsToHomeHref(parts: {
	genreId?: number | null;
	companyId?: number | null;
	sort?: string | null;
	venue?: HomeVenue | null;
	monetization?: string | null;
	watchRegion?: string | null;
	region?: string | null;
	releaseGte?: string | null;
}): string {
	void parts.genreId;
	void parts.companyId;
	void parts.watchRegion;
	void parts.region;
	void parts.releaseGte;

	const lobbySort = discoverSortToLobbySort(parts.sort);
	const venue = venueFromDiscoverParts({
		venue: parts.venue,
		monetization: parts.monetization,
		sort: lobbySort,
	});

	return buildHomeLobbyHref({
		browse: "movies",
		sort: lobbySort,
		venue,
	});
}

/** Legacy name — returns `/home` href (not `/movies/discover`). */
export function discoverCatalogUrl(
	parts: Parameters<typeof discoverPartsToHomeHref>[0],
) {
	return discoverPartsToHomeHref(parts);
}

/** Parses retired `/movies/discover?…` query strings for redirects. */
export function discoverSearchParamsToHomeHref(
	params: URLSearchParams,
): string {
	const venueRaw = params.get("venue")?.trim().toLowerCase();
	const venue =
		venueRaw === "theaters" || venueRaw === "streaming"
			? (venueRaw as HomeVenue)
			: null;

	return discoverPartsToHomeHref({
		genreId: Number(params.get("genre")) || null,
		companyId: Number(params.get("company")) || null,
		sort: params.get("sort"),
		venue,
		monetization: params.get("monetization"),
		watchRegion: params.get("watch_region"),
		region: params.get("region"),
		releaseGte: params.get("release_gte"),
	});
}
