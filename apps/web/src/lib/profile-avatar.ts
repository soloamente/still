import { env } from "@still/env/web";

/**
 * Authenticated stream for the signed-in user's portrait (`GET /api/profiles/me/avatar`).
 * Use with `fetch(..., { credentials: "include" })` — not with Next `<Image>` (no cookies).
 */
export function profileMeAvatarImageUrl(cacheKey?: string | number): string {
	const url = new URL("/api/profiles/me/avatar", env.NEXT_PUBLIC_SERVER_URL);
	if (cacheKey != null) {
		url.searchParams.set("v", String(cacheKey));
	}
	return url.href;
}

/**
 * Absolute URL for another patron's profile portrait (`GET /api/profiles/avatar/:handle`).
 * Proxies **private** Vercel Blob URLs (same problem as banners) and streams OAuth/CDN URLs
 * so Next `<Image>` always receives a fetchable `src`.
 */
export function profilePatronAvatarImageUrl(
	handle: string,
	/** Bust cache after the subject uploads a new portrait. */
	cacheKey?: string | number,
): string {
	const url = new URL(
		`/api/profiles/avatar/${encodeURIComponent(handle)}`,
		env.NEXT_PUBLIC_SERVER_URL,
	);
	if (cacheKey != null) {
		url.searchParams.set("v", String(cacheKey));
	}
	return url.href;
}

/**
 * Browser-safe portrait `src` for nav / menus — raw `user.image` blob URLs are not fetchable.
 */
export function resolvePatronPortraitSrc(
	handle: string | undefined,
	imageUrl: string | null | undefined,
	cacheKey?: string | number,
): string | null {
	if (!imageUrl?.trim()) return null;
	if (handle?.trim()) {
		return profilePatronAvatarImageUrl(handle, cacheKey);
	}
	return profileMeAvatarImageUrl(cacheKey);
}
