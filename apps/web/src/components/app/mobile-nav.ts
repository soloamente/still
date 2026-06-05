/** Active-route match for the mobile bar. Home matches only exactly; other
 *  tabs also match nested child routes (e.g. /notifications/abc). */
export function isActive(pathname: string, href: string): boolean {
	return (
		pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`))
	);
}

/**
 * Leaf detail pages (movie / TV) render their own fixed bottom action bar
 * (Add to Watched / Log / …) pinned to the viewport bottom, which would collide
 * with the global tab bar. Hide the tab bar on those detail roots — they have a
 * back button and their own actions. Sub-pages like `/movies/:id/credits` keep
 * the bar (no action bar there).
 */
export function shouldHideMobileTabBar(pathname: string): boolean {
	return /^\/(movies|tv)\/[^/]+$/.test(pathname);
}

export type MobileYouDestination = { href: string; label: string };

/** Long-tail destinations surfaced in the "You" hub sheet (everything not in the bar). */
export const MOBILE_YOU_DESTINATIONS: readonly MobileYouDestination[] = [
	{ href: "/diary", label: "Diary" },
	{ href: "/watchlist", label: "Watchlist" },
	{ href: "/lists", label: "Lists" },
	{ href: "/news", label: "News" },
	{ href: "/chat", label: "Chat" },
	{ href: "/achievements", label: "Achievements" },
] as const;
