import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	TV_ONGOING_DISCOVER_STATUS,
	tvDiscoverSortByForLobbySort,
} from "@/lib/home-catalog-run";
import { curatedTagBySlug } from "@/lib/search-curated-tags";

/** TMDb TV Animation genre — same id as curated **Anime** tag. */
export const ANIME_TV_GENRE_ID =
	curatedTagBySlug("anime")?.tv.genreIds[0] ?? 16;

/** Rolling simulcast window — first air within the last N days (v1 per SN.17.2 spec). */
export const ANIME_SEASON_ROLLING_DAYS = 90;

/** Reads `?animeSeason=1` on `/home?browse=tv`. */
export function parseHomeAnimeSeason(raw: string | null | undefined): boolean {
	if (!raw?.trim()) return false;
	const v = raw.trim().toLowerCase();
	return v === "1" || v === "true" || v === "yes";
}

/** UTC `YYYY-MM-DD` — lower bound for `first_air_date.gte` on the seasonal slice. */
export function animeSeasonRollingAirDateFloorUtc(
	now: Date = new Date(),
): string {
	const floor = new Date(now);
	floor.setUTCDate(floor.getUTCDate() - ANIME_SEASON_ROLLING_DAYS);
	return floor.toISOString().slice(0, 10);
}

export function isHomeAnimeSeasonLobby(input: {
	browse: HomeBrowseSurface;
	animeSeason: boolean;
}): boolean {
	return input.browse === "tv" && input.animeSeason;
}

/** Discover params for **This season** — airing animation TV started within the rolling window. */
export function animeSeasonTvDiscoverParams(sort: "latest" | "popular") {
	return {
		genreId: ANIME_TV_GENRE_ID,
		sortBy: tvDiscoverSortByForLobbySort(sort),
		status: TV_ONGOING_DISCOVER_STATUS,
		airDateGte: animeSeasonRollingAirDateFloorUtc(),
	} as const;
}
