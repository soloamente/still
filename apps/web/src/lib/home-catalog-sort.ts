import type { HomeBrowseSurface } from "@/lib/home-browse-surface";

export type HomeCatalogSort = "latest" | "popular" | "upcoming";

/** Normalises `?sort=` for the home lobby — shared by the RSC page and client chip strip. */
export function parseHomeCatalogSort(
	raw: string | undefined | null,
	_browse?: HomeBrowseSurface,
): HomeCatalogSort {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "popular" || s === "popularity") return "popular";
	if (s === "upcoming" || s === "coming" || s === "soon") return "upcoming";
	return "latest";
}
