/** Same-origin profile portrait paths — never use `NEXT_PUBLIC_SERVER_URL` (API host). */
function profileAvatarPath(
	pathname: string,
	cacheKey?: string | number,
): string {
	if (cacheKey == null) return pathname;
	return `${pathname}?v=${encodeURIComponent(String(cacheKey))}`;
}

/**
 * Authenticated stream for the signed-in user's portrait (`GET /api/profiles/me/avatar`).
 * Use with `fetch(..., { credentials: "include" })` — not with Next `<Image>` (no cookies).
 *
 * Prefer `profilePatronAvatarImageUrl(handle)` when the handle is known — that route is
 * public and avoids cookie / cross-origin issues on split web + API deploys.
 */
export function profileMeAvatarImageUrl(cacheKey?: string | number): string {
	return profileAvatarPath("/api/profiles/me/avatar", cacheKey);
}

/**
 * Same-origin URL for another patron's profile portrait (`GET /api/profiles/avatar/:handle`).
 * Proxies **private** Vercel Blob URLs (same problem as banners) and streams OAuth/CDN URLs
 * so Next `<Image>` always receives a fetchable `src`.
 */
export function profilePatronAvatarImageUrl(
	handle: string,
	/** Bust cache after the subject uploads a new portrait. */
	cacheKey?: string | number,
): string {
	return profileAvatarPath(
		`/api/profiles/avatar/${encodeURIComponent(handle)}`,
		cacheKey,
	);
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
