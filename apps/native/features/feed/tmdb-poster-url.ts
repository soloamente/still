/** TMDb still path → absolute poster URL. Ported from apps/web. */
export function tmdbPosterUrlFromPath(
	path: string | null | undefined,
	size: "w185" | "w342" | "w780" = "w185",
): string | null {
	if (!path?.length) return null;
	if (/^https?:\/\//i.test(path)) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/${size}${fragment}`;
}
