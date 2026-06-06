import { normalizeDiscoverMonetization } from "@/lib/discover-catalog-url";

import type { HomeCatalogSort } from "@/lib/home-catalog-sort";

import type { HomeVenue } from "@/lib/home-venue";

/** Query keys for in-lobby discover refinements on `/home`. */

export const HOME_CATALOG_FILTER_PARAMS = {
	genre: "genre",

	monetization: "monetization",
} as const;

/** Retired — sort lives on the left Popular · Latest · Upcoming rail only. */

const LEGACY_HOME_CATALOG_FILTER_PARAM = "discoverSort";

export type HomeCatalogFilters = {
	genreId: number | null;

	monetization: string | null;
};

export type HomeCatalogFilterContext = {
	venue: HomeVenue;

	sort: HomeCatalogSort;
};

function normalizeGenreId(raw: string | null | undefined): number | null {
	const n = Number(raw);

	if (!Number.isFinite(n) || n <= 0) return null;

	return Math.floor(n);
}

/** Parses and normalizes filter params for the active lobby slice. */

export function parseHomeCatalogFilters(
	params: URLSearchParams,

	context: HomeCatalogFilterContext,
): HomeCatalogFilters {
	const genreId = normalizeGenreId(
		params.get(HOME_CATALOG_FILTER_PARAMS.genre),
	);

	let monetization = normalizeDiscoverMonetization(
		params.get(HOME_CATALOG_FILTER_PARAMS.monetization),
	);

	if (context.venue === "theaters") {
		monetization = null;
	}

	return { genreId, monetization };
}

/** True when any non-default filter is active (shows slider dot + Clear). */

export function hasActiveHomeCatalogFilters(
	filters: HomeCatalogFilters,
): boolean {
	if (filters.genreId != null) return true;

	if (filters.monetization != null && filters.monetization !== "flatrate") {
		return true;
	}

	return false;
}

/** Drops filter fields incompatible with a new venue/sort context. */

export function stripIncompatibleHomeCatalogFilters(
	filters: HomeCatalogFilters,

	context: HomeCatalogFilterContext,
): HomeCatalogFilters {
	return parseHomeCatalogFilters(filtersToSearchParams(filters), context);
}

function filtersToSearchParams(filters: HomeCatalogFilters): URLSearchParams {
	const params = new URLSearchParams();

	if (filters.genreId != null) {
		params.set(HOME_CATALOG_FILTER_PARAMS.genre, String(filters.genreId));
	}

	if (filters.monetization != null) {
		params.set(
			HOME_CATALOG_FILTER_PARAMS.monetization,

			filters.monetization,
		);
	}

	return params;
}

/** Merges filter params into an existing `/home?…` href. */

export function mergeHomeCatalogFiltersIntoHref(
	baseHref: string,

	filters: HomeCatalogFilters,
): string {
	const url = new URL(baseHref, "http://still.local");

	for (const key of Object.values(HOME_CATALOG_FILTER_PARAMS)) {
		url.searchParams.delete(key);
	}

	// Strip legacy sort refinements — left-rail chips own ordering.

	url.searchParams.delete(LEGACY_HOME_CATALOG_FILTER_PARAM);

	if (filters.genreId != null) {
		url.searchParams.set(
			HOME_CATALOG_FILTER_PARAMS.genre,

			String(filters.genreId),
		);
	}

	if (filters.monetization != null && filters.monetization !== "flatrate") {
		url.searchParams.set(
			HOME_CATALOG_FILTER_PARAMS.monetization,

			filters.monetization,
		);
	}

	const qs = url.searchParams.toString();

	return qs ? `${url.pathname}?${qs}` : url.pathname;
}

/** Serialize filter fields for {@link buildHomeLobbyHref}. */

export function serializeHomeCatalogFiltersForHref(
	filters: HomeCatalogFilters,

	context: HomeCatalogFilterContext,
): HomeCatalogFilters {
	return stripIncompatibleHomeCatalogFilters(filters, context);
}
