import {
	type HomeBrowseSurface,
	homeBrowseSurfaceLabel,
	parseHomeBrowseSurface,
} from "@/lib/home-browse-surface";
import {
	buildHomeHrefFromPersisted,
	emptyHomeLobbyPersisted,
	readHomeLobbyPersisted,
	readLastHomeBrowseSurface,
} from "@/lib/home-lobby-persist";

export type MovieDetailReturn = {
	href: string;
	label: string;
};

/** SSR-safe back pill before client hydration reads sessionStorage / referrer. */
export const MOVIE_DETAIL_RETURN_SSR_FALLBACK: MovieDetailReturn = {
	href: "/home",
	label: "Movies",
};

/** Persisted when entering film/TV detail from another in-app route (client navigations). */
export const MOVIE_DETAIL_RETURN_STORAGE_KEY = "still:detail-return:v1";

type PersistedDetailReturn = {
	pathname: string;
	search: string;
};

/** Retired standalone movie catalogue routes — back target is the movies home lobby. */
const MOVIES_CATALOGUE_PATH =
	/^\/movies\/(popular|upcoming|discover|now-playing)(\/|$)/;

/** Main film/TV detail routes — excludes `/credits` and other subpages. */
export function isListingDetailPath(pathname: string): boolean {
	return /^\/movies\/\d+$/.test(pathname) || /^\/tv\/\d+$/.test(pathname);
}

/** Patron profile lobby — `/profile/[handle]`. */
export function isProfileLobbyPath(pathname: string): boolean {
	return pathname === "/profile" || pathname.startsWith("/profile/");
}

/** Account settings shell — `/me/settings` and sub-routes. */
export function isMeSettingsPath(pathname: string): boolean {
	return pathname === "/me/settings" || pathname.startsWith("/me/settings/");
}

function parseReturnPathname(href: string): string | null {
	try {
		const origin =
			typeof window !== "undefined"
				? window.location.origin
				: "https://still.local";
		return new URL(href, origin).pathname;
	} catch {
		return null;
	}
}

/** True when a back target is any account settings route. */
export function isMeSettingsReturnHref(href: string): boolean {
	const pathname = parseReturnPathname(href);
	if (!pathname) return href.startsWith("/me/settings");
	return isMeSettingsPath(pathname);
}

function isFilmDetailPath(pathname: string): boolean {
	return /^\/movies\/\d+(\/|$)/.test(pathname);
}

function isTvDetailPath(pathname: string): boolean {
	return /^\/tv\/\d+(\/|$)/.test(pathname);
}

function returnForHomeSurface(surface: HomeBrowseSurface): MovieDetailReturn {
	const persisted = readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted();
	return {
		href: buildHomeHrefFromPersisted(persisted, surface),
		label: homeBrowseSurfaceLabel(surface),
	};
}

function hrefFromPath(pathname: string, search: string): string {
	return search.length > 0 ? `${pathname}${search}` : pathname;
}

/** Maps a same-origin pathname (+ query) to a film-detail back target, when applicable. */
export function resolveMovieDetailReturnFromPath(
	pathname: string,
	search: string,
): MovieDetailReturn | null {
	if (pathname === "/diary" || pathname.startsWith("/diary/")) {
		return { href: "/diary", label: "Diary" };
	}
	if (pathname === "/watchlist" || pathname.startsWith("/watchlist/")) {
		return { href: "/watchlist", label: "Watchlist" };
	}
	if (pathname === "/home" || pathname.startsWith("/home/")) {
		const surface = parseHomeBrowseSurface(
			new URLSearchParams(search).get("browse"),
		);
		return returnForHomeSurface(surface);
	}
	if (MOVIES_CATALOGUE_PATH.test(pathname)) {
		return returnForHomeSurface("movies");
	}
	if (pathname === "/tv/discover" || pathname.startsWith("/tv/discover")) {
		return returnForHomeSurface("tv");
	}
	if (pathname === "/tv/on-the-air" || pathname.startsWith("/tv/on-the-air")) {
		return returnForHomeSurface("tv");
	}
	if (pathname === "/profile" || pathname.startsWith("/profile/")) {
		return {
			href: hrefFromPath(pathname, search),
			label: "Profile",
		};
	}
	if (pathname === "/lists/new") {
		return { href: "/lists/new", label: "New list" };
	}
	if (pathname === "/lists") {
		return { href: "/lists", label: "Lists" };
	}
	if (pathname.startsWith("/lists/")) {
		return { href: hrefFromPath(pathname, search), label: "List" };
	}
	if (pathname.startsWith("/people/")) {
		return { href: hrefFromPath(pathname, search), label: "Person" };
	}
	if (pathname.startsWith("/reviews/")) {
		return { href: hrefFromPath(pathname, search), label: "Review" };
	}
	if (pathname === "/search" || pathname.startsWith("/search")) {
		return { href: "/home", label: "Home" };
	}
	if (pathname === "/achievements" || pathname.startsWith("/achievements")) {
		return { href: "/achievements", label: "Achievements" };
	}
	if (pathname === "/notifications" || pathname.startsWith("/notifications")) {
		return { href: "/notifications", label: "Notifications" };
	}
	if (pathname === "/chat" || pathname.startsWith("/chat")) {
		return { href: "/chat", label: "Chat" };
	}
	if (pathname === "/news" || pathname.startsWith("/news")) {
		return { href: "/news", label: "News" };
	}
	if (pathname === "/changelog" || pathname.startsWith("/changelog")) {
		return { href: "/changelog", label: "Changelog" };
	}
	if (pathname === "/me/settings" || pathname.startsWith("/me/settings")) {
		return { href: "/me/settings", label: "Settings" };
	}
	if (
		pathname === "/me/customization" ||
		pathname.startsWith("/me/customization")
	) {
		return { href: "/me/settings/profile", label: "Profile" };
	}
	const movieCredits = pathname.match(/^\/movies\/(\d+)\/credits$/);
	if (movieCredits) {
		return {
			href: `/movies/${movieCredits[1]}`,
			label: "Film",
		};
	}
	const tvCredits = pathname.match(/^\/tv\/(\d+)\/credits$/);
	if (tvCredits) {
		return {
			href: `/tv/${tvCredits[1]}`,
			label: "Series",
		};
	}
	return null;
}

/** Write the route the patron was on immediately before opening film/TV detail. */
export function persistMovieDetailReturn(
	pathname: string,
	search: string,
): void {
	if (typeof window === "undefined") return;
	const resolved = resolveMovieDetailReturnFromPath(pathname, search);
	if (!resolved) return;
	try {
		const payload: PersistedDetailReturn = { pathname, search };
		sessionStorage.setItem(
			MOVIE_DETAIL_RETURN_STORAGE_KEY,
			JSON.stringify(payload),
		);
	} catch {
		// Private mode / quota — ignore.
	}
}

function readPersistedMovieDetailReturn(): MovieDetailReturn | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = sessionStorage.getItem(MOVIE_DETAIL_RETURN_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PersistedDetailReturn;
		if (!parsed?.pathname) return null;
		return (
			resolveMovieDetailReturnFromPath(parsed.pathname, parsed.search ?? "") ??
			null
		);
	} catch {
		return null;
	}
}

function homeBrowseFallback(): MovieDetailReturn {
	return returnForHomeSurface(readLastHomeBrowseSurface());
}

/** True when both hrefs target the same patron profile (query may differ). */
export function isSameProfileReturnHref(
	currentPathname: string,
	candidateHref: string,
): boolean {
	if (
		currentPathname !== "/profile" &&
		!currentPathname.startsWith("/profile/")
	) {
		return false;
	}
	try {
		const origin =
			typeof window !== "undefined"
				? window.location.origin
				: "https://still.local";
		const candidate = new URL(candidateHref, origin);
		return candidate.pathname === currentPathname;
	} catch {
		return candidateHref.split("?")[0] === currentPathname;
	}
}

/**
 * Session snapshot, then same-origin referrer — used by film detail and profile back pills.
 * Returns null when neither source yields a usable in-app route.
 */
function resolveDetailReturnCandidate(): MovieDetailReturn | null {
	const persisted = readPersistedMovieDetailReturn();
	if (persisted) return persisted;

	try {
		const ref = document.referrer;
		if (!ref) return null;
		const url = new URL(ref);
		if (url.origin !== window.location.origin) return null;
		if (isFilmDetailPath(url.pathname) || isTvDetailPath(url.pathname)) {
			return null;
		}
		return resolveMovieDetailReturnFromPath(url.pathname, url.search);
	} catch {
		return null;
	}
}

/** Client-only: persisted in-app route, then referrer, else last `/home` browse rail. */
export function resolveMovieDetailReturn(): MovieDetailReturn {
	const fallback = homeBrowseFallback();
	if (typeof window === "undefined") return fallback;
	return resolveDetailReturnCandidate() ?? fallback;
}

/**
 * Profile lobby back target — never loops to the profile the patron is already viewing
 * (common after refresh or returning from a title opened on this profile).
 */
export function resolveProfileReturn(
	pathname: string,
	_search: string,
): MovieDetailReturn {
	const fallback = homeBrowseFallback();
	if (typeof window === "undefined") return fallback;

	const candidate = resolveDetailReturnCandidate();
	if (!candidate) return fallback;

	if (isSameProfileReturnHref(pathname, candidate.href)) {
		return fallback;
	}

	// Settings exposes its own Profile pill — profile back should escape to home, not ping-pong.
	if (isMeSettingsReturnHref(candidate.href)) {
		return fallback;
	}

	return candidate;
}

/**
 * Settings shell back target — remembers the prior in-app route (home, profile, etc.)
 * instead of always linking to the public profile.
 */
export function resolveSettingsReturn(pathname: string): MovieDetailReturn {
	const fallback = homeBrowseFallback();
	if (typeof window === "undefined") return fallback;

	const candidate = resolveDetailReturnCandidate();
	if (!candidate) return fallback;

	const currentPath = parseReturnPathname(pathname);
	const targetPath = parseReturnPathname(candidate.href);
	if (
		currentPath &&
		targetPath &&
		isMeSettingsPath(currentPath) &&
		isMeSettingsPath(targetPath)
	) {
		return fallback;
	}

	return candidate;
}
