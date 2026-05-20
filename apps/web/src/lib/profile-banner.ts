import { env } from "@still/env/web";

/**
 * Absolute URL for the profile banner image. Always goes through the API
 * (`GET /api/profiles/banner/:handle`) so **private** Vercel Blob objects
 * (which are not directly fetchable in the browser) still render.
 */
export function profileBannerImageUrl(
	handle: string,
	/** Bust CDN/browser cache after a new upload on the customize page. */
	cacheKey?: string | number,
): string {
	const url = new URL(
		`/api/profiles/banner/${encodeURIComponent(handle)}`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
	if (cacheKey != null) {
		url.searchParams.set("v", String(cacheKey));
	}
	return url.href;
}
