/** Active-route match for the mobile bar. Home matches only exactly; other
 *  tabs also match nested child routes (e.g. /notifications/abc). */
export function isActive(pathname: string, href: string): boolean {
	return (
		pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`))
	);
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
