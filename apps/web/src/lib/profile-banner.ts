/**
 * Same-origin URL for the profile banner image. Always goes through the API
 * (`GET /api/profiles/banner/:handle`) so **private** Vercel Blob objects
 * (which are not directly fetchable in the browser) still render.
 */
export function profileBannerImageUrl(
	handle: string,
	/** Bust CDN/browser cache after a new upload on the customize page. */
	cacheKey?: string | number,
): string {
	const pathname = `/api/profiles/banner/${encodeURIComponent(handle)}`;
	if (cacheKey == null) return pathname;
	return `${pathname}?v=${encodeURIComponent(String(cacheKey))}`;
}
