/** TMDb still path → absolute backdrop URL for lobby heroes and OG art. */
export function tmdbBackdropUrlFromPath(
	path: string | null | undefined,
	size: "w780" | "w1280" | "original" = "w1280",
): string | null {
	if (!path?.length) return null;
	if (/^https?:\/\//i.test(path)) return path;
	const fragment = path.startsWith("/") ? path : `/${path}`;
	return `https://image.tmdb.org/t/p/${size}${fragment}`;
}
