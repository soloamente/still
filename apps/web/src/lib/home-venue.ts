import type { HomeCatalogSort } from "@/lib/home-catalog-sort";

/** Where the patron wants catalogue emphasis — orthogonal to Latest vs Popular (`sort`). */
export type HomeVenue = "theaters" | "streaming";

/** When `?venue=` is absent, mirror the toolbar mapping (Latest/Upcoming↔theaters, Popular↔streaming). */
export function defaultHomeVenueForSort(sort: HomeCatalogSort): HomeVenue {
	return sort === "latest" || sort === "upcoming" ? "theaters" : "streaming";
}

/** Resolves `?venue=` for `/home` movie + TV catalogue chrome (invalid values fall back to sort defaults). */
export function parseHomeVenue(
	raw: string | null | undefined,
	catalogSort: HomeCatalogSort,
): HomeVenue {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "theaters" || s === "theatre" || s === "theatrical") {
		return "theaters";
	}
	if (s === "streaming" || s === "home" || s === "digital") {
		return "streaming";
	}
	return defaultHomeVenueForSort(catalogSort);
}

/** Parses `?venue=` only when present — `/movies/discover` uses this so a bare URL stays unfiltered. */
export function parseExplicitHomeVenue(
	raw: string | null | undefined,
): HomeVenue | null {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "theaters" || s === "theatre" || s === "theatrical") {
		return "theaters";
	}
	if (s === "streaming" || s === "home" || s === "digital") {
		return "streaming";
	}
	return null;
}
