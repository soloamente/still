import { normalizeDiscoverMonetization } from "@/lib/discover-catalog-url";
import type { HomeCatalogRun } from "@/lib/home-catalog-run";
import {
	TV_COMPLETED_DISCOVER_STATUS,
	TV_ONGOING_DISCOVER_STATUS,
} from "@/lib/home-catalog-run";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { HomeVenue } from "@/lib/home-venue";

/**
 * Canonical query builder for TV discover slices — now targets `/home?browse=tv`
 * instead of the retired `/tv/discover` route.
 */
export function tvDiscoverPartsToHomeHref(parts: {
	genreId?: number | null;
	sort?: string | null;
	airDateGte?: string | null;
	monetization?: string | null;
	watchRegion?: string | null;
	status?: string | null;
}): string {
	void parts.watchRegion;

	const status = parseTvDiscoverStatusParam(parts.status);
	const hasUpcomingWindow = Boolean(parts.airDateGte?.trim());

	let run: HomeCatalogRun | null = null;
	if (status === TV_ONGOING_DISCOVER_STATUS) {
		run = "ongoing";
	} else if (status === TV_COMPLETED_DISCOVER_STATUS) {
		run = "completed";
	} else if (hasUpcomingWindow) {
		run = "upcoming";
	}

	const sortRaw = parts.sort?.trim() ?? "";
	const lobbySort: HomeCatalogSort =
		sortRaw === "first_air_date.desc" || sortRaw === "first_air_date.asc"
			? "latest"
			: "popular";

	let venue: HomeVenue | undefined;
	if (run === "upcoming") {
		venue =
			normalizeDiscoverMonetization(parts.monetization) === "flatrate"
				? "streaming"
				: "theaters";
	}

	return buildHomeLobbyHref({
		browse: "tv",
		sort: run === "upcoming" ? "popular" : lobbySort,
		run,
		venue,
		genreId: parts.genreId,
		monetization: parts.monetization,
	});
}

/** Legacy name — returns `/home` href (not `/tv/discover`). */
export function tvDiscoverCatalogUrl(
	parts: Parameters<typeof tvDiscoverPartsToHomeHref>[0],
) {
	return tvDiscoverPartsToHomeHref(parts);
}

/** Parses retired `/tv/discover?…` query strings for redirects. */
export function tvDiscoverSearchParamsToHomeHref(
	params: URLSearchParams,
): string {
	return tvDiscoverPartsToHomeHref({
		genreId: Number(params.get("genre")) || null,
		sort: params.get("sort"),
		airDateGte: params.get("air_date_gte"),
		monetization: params.get("monetization"),
		watchRegion: params.get("watch_region"),
		status: params.get("status"),
	});
}

/** Normalises `?status=` for TV discover — same whitelist as `GET /api/tv/discover`. */
export function parseTvDiscoverStatusParam(
	raw: string | undefined | null,
): string | null {
	const s = raw?.trim().toLowerCase() ?? "";
	if (
		s === TV_ONGOING_DISCOVER_STATUS ||
		s === "ongoing" ||
		s === "returning" ||
		s === "on-air" ||
		s === "on_the_air"
	) {
		return TV_ONGOING_DISCOVER_STATUS;
	}
	if (
		s === TV_COMPLETED_DISCOVER_STATUS ||
		s === "ended" ||
		s === "completed" ||
		s === "complete"
	) {
		return TV_COMPLETED_DISCOVER_STATUS;
	}
	return null;
}
