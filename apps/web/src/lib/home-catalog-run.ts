import type { HomeBrowseSurface } from "@/lib/home-browse-surface";

/** TV catalogue slice on `/home?browse=tv` — orthogonal to left-rail `sort` (Popular / Latest). */
export type HomeCatalogRun = "ongoing" | "completed" | "upcoming";

/**
 * TMDb discover `?status=` for **Ongoing** — Returning Series (`with_status=0`).
 * Distinct from **Completed** (`ended` / `3`) so the two rails do not overlap.
 */
export const TV_ONGOING_DISCOVER_STATUS = "returning";

/** TMDb discover `?status=` for **Completed** — Ended (`with_status=3`). */
export const TV_COMPLETED_DISCOVER_STATUS = "ended";

/** Reads `?run=` for the TV lobby; ignores on Movies / Community. */
export function parseHomeCatalogRun(
	raw: string | undefined | null,
	browse?: HomeBrowseSurface,
): HomeCatalogRun | null {
	if (browse !== "tv") return null;
	const s = raw?.trim().toLowerCase() ?? "";
	if (
		s === "ongoing" ||
		s === "on-air" ||
		s === "on_the_air" ||
		s === "airing"
	) {
		return "ongoing";
	}
	if (s === "completed" || s === "ended" || s === "complete") {
		return "completed";
	}
	if (s === "upcoming" || s === "coming" || s === "soon") {
		return "upcoming";
	}
	return null;
}

/** Maps left-rail sort to TMDb discover `sort_by` for TV discover slices (`completed`, `latest`). */
export function tvDiscoverSortByForLobbySort(
	sort: "latest" | "popular",
): string {
	if (sort === "popular") return "popularity.desc";
	return "first_air_date.desc";
}

/** TMDb discover `sort_by` for the TV **Upcoming** slice (first air dates ahead, soonest first). */
export const TV_UPCOMING_DISCOVER_SORT = "first_air_date.asc";
