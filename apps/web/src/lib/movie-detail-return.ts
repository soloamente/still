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

/** Persisted when entering film/TV detail from another in-app route (client navigations). */
export const MOVIE_DETAIL_RETURN_STORAGE_KEY = "still:detail-return:v1";

type PersistedDetailReturn = {
	pathname: string;
	search: string;
};

const MOVIES_CATALOGUE_PATH =
	/^\/movies\/(popular|upcoming|discover|now-playing)(\/|$)/;

/** Main film/TV detail routes — excludes `/credits` and other subpages. */
export function isListingDetailPath(pathname: string): boolean {
	return /^\/movies\/\d+$/.test(pathname) || /^\/tv\/\d+$/.test(pathname);
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
		return { href: hrefFromPath(pathname, search), label: "Search" };
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
	if (pathname === "/me/settings" || pathname.startsWith("/me/settings")) {
		return { href: "/me/settings", label: "Settings" };
	}
	if (
		pathname === "/me/customization" ||
		pathname.startsWith("/me/customization")
	) {
		return { href: "/me/customization", label: "Customize" };
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

/** Client-only: persisted in-app route, then referrer, else last `/home` browse rail. */
export function resolveMovieDetailReturn(): MovieDetailReturn {
	const fallback = returnForHomeSurface(readLastHomeBrowseSurface());

	if (typeof window === "undefined") return fallback;

	const persisted = readPersistedMovieDetailReturn();
	if (persisted) return persisted;

	try {
		const ref = document.referrer;
		if (!ref) return fallback;
		const url = new URL(ref);
		if (url.origin !== window.location.origin) return fallback;
		if (isFilmDetailPath(url.pathname) || isTvDetailPath(url.pathname)) {
			return fallback;
		}
		return (
			resolveMovieDetailReturnFromPath(url.pathname, url.search) ?? fallback
		);
	} catch {
		return fallback;
	}
}
