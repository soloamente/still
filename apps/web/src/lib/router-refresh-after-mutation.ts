/**
 * App routes whose RSC payloads include diary logs, reviews, or community scores.
 * Call `router.refresh()` after mutations on these paths so detail surfaces update
 * without a full navigation (see quick-log + review composer).
 */
export function shouldRefreshRouteAfterMutation(pathname: string): boolean {
	return (
		pathname.startsWith("/movies/") ||
		pathname.startsWith("/tv/") ||
		pathname.startsWith("/diary") ||
		pathname.startsWith("/profile")
	);
}
