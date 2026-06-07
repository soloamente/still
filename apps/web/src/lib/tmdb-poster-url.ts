/** TMDb still path → absolute poster URL (feed thumbs, review cards, activity rows). */
export function tmdbPosterUrlFromPath(
	path: string | null | undefined,
	size: "w92" | "w185" | "w342" | "w780" = "w185",
): string | null {
	if (!path?.length) return null;
	// Custom list covers and other absolute URLs must not get a TMDb prefix.
	if (/^https?:\/\//i.test(path)) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/${size}${fragment}`;
}
