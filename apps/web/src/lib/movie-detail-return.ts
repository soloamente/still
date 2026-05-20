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

const MOVIES_CATALOGUE_PATH =
	/^\/movies\/(popular|upcoming|discover|now-playing)(\/|$)/;

function isFilmDetailPath(pathname: string): boolean {
	return /^\/movies\/\d+(\/|$)/.test(pathname);
}

function isTvDetailPath(pathname: string): boolean {
	return /^\/tv\/\d+(\/|$)/.test(pathname);
}

function isProfilePath(pathname: string): boolean {
	return /^\/profile\/[^/]+(\/|$)/.test(pathname);
}

function returnForHomeSurface(surface: HomeBrowseSurface): MovieDetailReturn {
	const persisted = readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted();
	return {
		href: buildHomeHrefFromPersisted(persisted, surface),
		label: homeBrowseSurfaceLabel(surface),
	};
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
	const profileHandle = pathname.match(/^\/profile\/([^/]+)/)?.[1];
	if (profileHandle) {
		const qs = search.length > 0 ? search : "";
		return {
			href: `/profile/${profileHandle}${qs}`,
			label: `@${decodeURIComponent(profileHandle)}`,
		};
	}
	return null;
}

/** Client-only: prefer referrer, else last `/home` browse rail from localStorage. */
export function resolveMovieDetailReturn(): MovieDetailReturn {
	const fallback = returnForHomeSurface(readLastHomeBrowseSurface());

	if (typeof window === "undefined") return fallback;

	try {
		const ref = document.referrer;
		if (!ref) return fallback;
		const url = new URL(ref);
		if (url.origin !== window.location.origin) return fallback;
		if (isFilmDetailPath(url.pathname)) return fallback;
		if (isTvDetailPath(url.pathname)) return fallback;
		if (isProfilePath(url.pathname)) return fallback;
		return (
			resolveMovieDetailReturnFromPath(url.pathname, url.search) ?? fallback
		);
	} catch {
		return fallback;
	}
}
