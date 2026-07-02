/** TMDb logo still path → absolute URL for title lockups on lobby heroes. */
export function tmdbLogoUrlFromPath(
	path: string | null | undefined,
	size: "w185" | "w300" | "w500" | "original" = "w500",
): string | null {
	if (!path?.length) return null;
	if (/^https?:\/\//i.test(path)) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/${size}${fragment}`;
}
