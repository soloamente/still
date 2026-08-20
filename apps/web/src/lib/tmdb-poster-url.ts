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

/**
 * True when `src` is already served from TMDb's CDN.
 * Skip Vercel `/_next/image` for these — TMDb already ships sized JPEGs; re-encoding
 * drives Image Optimization transformations + cache-write units and Edge Requests.
 */
export function isTmdbCdnUrl(src: string | null | undefined): boolean {
	if (!src?.length) return false;
	// Relative / same-origin paths must not inherit a TMDb base URL.
	if (!/^https?:\/\//i.test(src)) return false;
	try {
		return new URL(src).hostname === "image.tmdb.org";
	} catch {
		return false;
	}
}
