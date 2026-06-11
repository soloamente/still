/**
 * App routes that must render without a session so link previews (iMessage,
 * Slack, X, etc.) receive page-level Open Graph metadata and can fetch `/og/*`
 * image URLs. Kept in one module so `proxy.ts` and `(app)/layout.tsx` stay aligned.
 */
const SHAREABLE_APP_PREFIXES = [
	"/movies/",
	"/tv/",
	"/profile/",
	"/people/",
] as const;

/** True when an unsigned visitor (or social crawler) may view this `(app)` path. */
export function isShareableAppPath(pathname: string): boolean {
	return SHAREABLE_APP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
