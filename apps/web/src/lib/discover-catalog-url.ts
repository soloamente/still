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
}) {
	const params = new URLSearchParams();
	if (parts.genreId != null && parts.genreId > 0) {
		params.set("genre", String(parts.genreId));
	}
	const s = parts.sort?.trim();
	if (s && s !== DISCOVER_SORT_DEFAULT) {
		params.set("sort", s);
	}
	const q = params.toString();
	return q ? `/movies/discover?${q}` : "/movies/discover";
}
