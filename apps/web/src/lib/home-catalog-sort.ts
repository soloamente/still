export type HomeCatalogSort = "latest" | "popular";

/** Normalises `?sort=` for the home lobby — shared by the RSC page and client chip strip. */
export function parseHomeCatalogSort(
	raw: string | undefined | null,
): HomeCatalogSort {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "popular" || s === "popularity") return "popular";
	return "latest";
}
