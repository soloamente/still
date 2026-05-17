export type HomeBrowseSurface = "movies" | "tv" | "community";

/** Normalises `?browse=` for the home lobby — shared by RSC, sticky chrome, and sort chips. */
export function parseHomeBrowseSurface(
	raw: string | undefined | null,
): HomeBrowseSurface {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "tv" || s === "shows" || s === "television") return "tv";
	if (s === "community" || s === "social") return "community";
	return "movies";
}
