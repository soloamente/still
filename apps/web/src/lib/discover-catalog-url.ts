import type { HomeVenue } from "@/lib/home-venue";

/**
 * Canonical query builder for `/movies/discover` — keeps chip hrefs and the
 * infinite-scroll fetcher aligned on the same sort + genre vocabulary.
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

export function discoverCatalogUrl(parts: {
	genreId?: number | null;
	sort?: string | null;
	/** Theatrical vs digital-at-home slice — forwarded to TMDb `with_release_type`. */
	venue?: HomeVenue | null;
	/** Subscription / rent / etc. — `?monetization=` (server maps to TMDb + `watch_region`). */
	monetization?: string | null;
	/** Optional ISO 3166-1 alpha-2 for `watch_region` when monetization is set. */
	watchRegion?: string | null;
	/** Optional ISO 3166-1 alpha-2 — TMDb `region` for theatrical release-date filters. */
	region?: string | null;
	/** Optional YYYY-MM-DD — TMDb `primary_release_date.gte` (e.g. future streaming window). */
	releaseGte?: string | null;
}) {
	const params = new URLSearchParams();
	if (parts.genreId != null && parts.genreId > 0) {
		params.set("genre", String(parts.genreId));
	}
	const s = parts.sort?.trim();
	if (s && s !== DISCOVER_SORT_DEFAULT) {
		params.set("sort", s);
	}
	if (parts.venue === "theaters" || parts.venue === "streaming") {
		params.set("venue", parts.venue);
	}
	const m = normalizeDiscoverMonetization(parts.monetization);
	if (m) {
		params.set("monetization", m);
	}
	const wr = parts.watchRegion?.trim().toUpperCase();
	if (wr === "ALL" || wr === "ANY" || wr === "WORLD") {
		params.set("watch_region", "ALL");
	} else if (wr && /^[A-Z]{2}$/.test(wr)) {
		params.set("watch_region", wr);
	}
	const reg = parts.region?.trim().toUpperCase();
	if (reg && /^[A-Z]{2}$/.test(reg)) {
		params.set("region", reg);
	}
	const rg = parts.releaseGte?.trim();
	if (rg && /^\d{4}-\d{2}-\d{2}$/.test(rg)) {
		params.set("release_gte", rg);
	}
	const q = params.toString();
	return q ? `/movies/discover?${q}` : "/movies/discover";
}
