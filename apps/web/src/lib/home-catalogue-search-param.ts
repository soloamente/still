import { parseHomeCatalogSort } from "@/lib/home-catalog-sort";
import {
	buildHomeHrefFromPersisted,
	emptyHomeLobbyPersisted,
	type HomeLobbyPersisted,
} from "@/lib/home-lobby-persist";
import type { SearchDialogStudio } from "@/lib/search-dialog-studios";
import {
	displayTagSegmentLabel,
	type ParseRecentOptions,
	parseRecentStructuredQuery,
	type SearchTag,
	STRUCTURED_QUERY_SEP,
	serializeStructuredQuery,
} from "@/lib/search-query-tags";
import type { CatalogTextSearchListingKind } from "@/lib/use-catalog-text-search";

/** `/home` URL key for a committed catalogue search (tags + free text). */
export const HOME_CATALOGUE_SEARCH_PARAM = "search";

/** Default left-rail sort when Enter commits a catalogue search. */
export const HOME_CATALOGUE_SEARCH_DEFAULT_SORT = "popular" as const;

export type HomeCatalogueSearchLobbySort = "popular" | "latest";

/** Popular / Latest only — committed search ignores Upcoming on the left rail. */
export function parseHomeCatalogueSearchLobbySort(
	params: URLSearchParams,
	browse: "movies" | "tv",
): HomeCatalogueSearchLobbySort {
	const raw = params.get("sort")?.trim();
	if (!raw) {
		return HOME_CATALOGUE_SEARCH_DEFAULT_SORT;
	}
	const sort = parseHomeCatalogSort(raw, browse);
	return sort === "popular" ? "popular" : "latest";
}

/** Updates `?sort=` while keeping a committed `?search=` payload. */
export function buildHomeCatalogueSearchSortHref(input: {
	browse: "movies" | "tv";
	sort: HomeCatalogueSearchLobbySort;
	currentParams?: URLSearchParams;
}): string {
	const params = new URLSearchParams();
	if (input.browse === "tv") {
		params.set("browse", "tv");
	}
	const searchRaw = input.currentParams
		?.get(HOME_CATALOGUE_SEARCH_PARAM)
		?.trim();
	if (searchRaw) {
		params.set(HOME_CATALOGUE_SEARCH_PARAM, searchRaw);
	}
	params.set("sort", input.sort);
	const qs = params.toString();
	return qs ? `/home?${qs}` : "/home";
}

/**
 * True when Enter should commit the dialog draft to the lobby catalogue grid.
 * Lists mode and empty drafts do not commit; any other catalogue tag or text does.
 */
export function canCommitCatalogueSearch(
	tags: SearchTag[],
	freeText: string,
): boolean {
	if (tags.some((t) => t.kind === "lists")) return false;
	if (tags.some((t) => t.kind !== "lists")) return true;
	const q = freeText.trim();
	if (!q) return false;
	// `@handle` people typeahead — no catalogue tags → do not commit lobby grid.
	if (/^@+/.test(q)) return false;
	return true;
}

/** Serializes committed tags + free text for the `search` URL param. */
export function serializeHomeCatalogueSearchParam(
	tags: SearchTag[],
	freeText: string,
): string {
	// Browse rail already implies Films vs TV — omit redundant media pills from `?search=`.
	const catalogueTags = tags.filter((tag) => tag.kind !== "media");
	return serializeStructuredQuery(catalogueTags, freeText);
}

/** Restores tags + free text from the `search` URL param (middle-dot segments). */
export function parseHomeCatalogueSearchParam(
	raw: string | null | undefined,
	studios: SearchDialogStudio[],
	options: ParseRecentOptions = {},
): { tags: SearchTag[]; freeText: string } {
	const trimmed = raw?.trim() ?? "";
	if (!trimmed) return { tags: [], freeText: "" };
	return parseRecentStructuredQuery(trimmed, studios, options);
}

/** Headbar pill label — patron names, not `studio:41077` tokens. */
export function formatCommittedSearchSummary(
	tags: SearchTag[],
	freeText: string,
	maxLen = 40,
): string {
	const parts = tags
		.filter((tag) => tag.kind !== "media")
		.map(displayTagSegmentLabel);
	const ft = freeText.trim();
	if (ft) parts.push(ft);
	const full = parts.join(STRUCTURED_QUERY_SEP).trim();
	if (!full) return "";
	if (full.length <= maxLen) return full;
	return `${full.slice(0, maxLen - 1)}…`;
}

/** Maps dialog draft to `/home` browse rail (`movies` | `tv`). */
export function resolveCommitBrowseFromDraft(
	tags: SearchTag[],
	listingKind: CatalogTextSearchListingKind,
): "movies" | "tv" {
	const media = tags.find(
		(t): t is Extract<SearchTag, { kind: "media" }> => t.kind === "media",
	);
	if (media) return media.listingKind === "tv" ? "tv" : "movies";
	return listingKind === "tv" ? "tv" : "movies";
}

/**
 * Builds `/home?browse=…&search=…` for Enter-to-commit.
 * Strips sort/venue/run/animeSeason so search replaces the browse grid.
 */
export function buildHomeCatalogueSearchCommitHref(input: {
	pathname?: string;
	browse: "movies" | "tv";
	tags: SearchTag[];
	freeText: string;
	/** Reserved for callers merging params; commit href only sets `browse` + `search`. */
	currentParams?: URLSearchParams;
}): string {
	const pathname = input.pathname ?? "/home";
	const params = new URLSearchParams();

	if (input.browse === "tv") {
		params.set("browse", "tv");
	}

	params.set("sort", HOME_CATALOGUE_SEARCH_DEFAULT_SORT);

	const serialized = serializeHomeCatalogueSearchParam(
		input.tags,
		input.freeText,
	);
	if (serialized.trim()) {
		params.set(HOME_CATALOGUE_SEARCH_PARAM, serialized);
	}

	const qs = params.toString();
	return qs ? `${pathname}?${qs}` : pathname;
}

/** Removes `search` and restores the last persisted browse chips for the surface. */
export function buildHomeCatalogueSearchClearHref(
	browse: "movies" | "tv",
	persisted?: HomeLobbyPersisted | null,
): string {
	const slot = persisted ?? emptyHomeLobbyPersisted();
	return buildHomeHrefFromPersisted(slot, browse === "tv" ? "tv" : "movies");
}

/** True when `/home` has an active committed catalogue search for Movies or TV. */
export function isHomeCatalogueSearchActive(
	params: URLSearchParams,
	browse: "movies" | "tv" | "community",
): boolean {
	if (browse === "community") return false;
	const raw = params.get(HOME_CATALOGUE_SEARCH_PARAM)?.trim();
	return Boolean(raw);
}

/** Reads committed search from URL search params (null when inactive). */
export function readHomeCatalogueSearchFromParams(
	params: URLSearchParams,
	studios: SearchDialogStudio[],
	options: ParseRecentOptions = {},
): { tags: SearchTag[]; freeText: string } | null {
	const raw = params.get(HOME_CATALOGUE_SEARCH_PARAM);
	if (!raw?.trim()) return null;
	return parseHomeCatalogueSearchParam(raw, studios, options);
}
