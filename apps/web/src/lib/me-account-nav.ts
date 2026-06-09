/** Ordered sidebar routes under `/me/*` — index drives page-slide direction. */
export const ME_ACCOUNT_NAV_ITEMS = [
	{ href: "/me/settings/profile", label: "Profile" },
	{ href: "/me/settings/notifications", label: "Notifications" },
	{ href: "/me/settings/catalogue", label: "Catalogue" },
	{ href: "/me/settings/appearance", label: "Appearance" },
	{ href: "/me/settings/data", label: "Data" },
	{ href: "/me/settings/experience", label: "Experience" },
] as const;

export type MeAccountNavHref = (typeof ME_ACCOUNT_NAV_ITEMS)[number]["href"];

/** Canonical settings entry — first sidebar section. */
export const ME_ACCOUNT_SETTINGS_HOME_HREF = ME_ACCOUNT_NAV_ITEMS[0].href;

/** Legacy `/me/settings` and unknown subpaths resolve to Profile for nav + transitions. */
export function resolveMeAccountNavPath(pathname: string): string {
	if (pathname === "/me/settings" || pathname === "/me/settings/") {
		return ME_ACCOUNT_SETTINGS_HOME_HREF;
	}
	// Legacy route — the Imports tab became Data (import + export + danger zone).
	if (
		pathname === "/me/settings/imports" ||
		pathname.startsWith("/me/settings/imports/")
	) {
		return "/me/settings/data";
	}
	const match = ME_ACCOUNT_NAV_ITEMS.find(
		(item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
	);
	if (match) return match.href;
	if (pathname.startsWith("/me/settings/")) {
		return ME_ACCOUNT_SETTINGS_HOME_HREF;
	}
	return pathname;
}

export function meAccountNavIndex(pathname: string): number {
	const resolved = resolveMeAccountNavPath(pathname);
	const idx = ME_ACCOUNT_NAV_ITEMS.findIndex((item) => item.href === resolved);
	return idx === -1 ? 0 : idx;
}

export function isMeAccountNavActive(
	pathname: string,
	href: MeAccountNavHref,
): boolean {
	return resolveMeAccountNavPath(pathname) === href;
}
