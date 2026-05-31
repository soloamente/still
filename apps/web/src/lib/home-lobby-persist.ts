import { parseHomeAnimeSeason } from "@/lib/home-anime-season";
import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import {
	type HomeCatalogRun,
	parseHomeCatalogRun,
} from "@/lib/home-catalog-run";
import {
	type HomeCatalogSort,
	parseHomeCatalogSort,
} from "@/lib/home-catalog-sort";
import {
	DEFAULT_HOME_COMMUNITY_FEED,
	type HomeCommunityFeed,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import {
	DEFAULT_HOME_LEADERBOARD_PERIOD,
	type HomeLeaderboardPeriod,
	parseHomeCommunityPeriod,
} from "@/lib/home-leaderboard-period";
import { writeHomeLobbyHrefCookie } from "@/lib/home-lobby-cookie";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import {
	defaultHomeVenueForSort,
	type HomeVenue,
	parseHomeVenue,
} from "@/lib/home-venue";

/** localStorage payload — each lobby rail remembers its own last chips / venue. */
export interface HomeLobbyPersisted {
	movies: { sort: HomeCatalogSort; venue: HomeVenue } | null;
	tv: {
		sort: HomeCatalogSort;
		venue: HomeVenue;
		run: HomeCatalogRun | null;
		animeSeason?: boolean;
	} | null;
	community: {
		feed: HomeCommunityFeed;
		period?: HomeLeaderboardPeriod;
	} | null;
	/** Last `/home` browse rail — used when film detail has no same-origin referrer. */
	lastBrowseSurface?: HomeBrowseSurface | null;
}

const STORAGE_KEY = "still.home-lobby-persist-v1";

/** Default bucket before the patron visits each rail — callers merge reads with this. */
export function emptyHomeLobbyPersisted(): HomeLobbyPersisted {
	return { movies: null, tv: null, community: null };
}

/** Reads persisted lobby prefs (null when missing / invalid / private mode). */
export function readHomeLobbyPersisted(): HomeLobbyPersisted | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return null;
		return parsed as HomeLobbyPersisted;
	} catch {
		return null;
	}
}

function writeHomeLobbyPersisted(next: HomeLobbyPersisted): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// Quota / private mode — ignore; in-session navigation still works.
	}
}

/**
 * Merges the active `/home` URL into the matching slot so diary / watchlist chrome
 * can rebuild the same catalogue when the patron returns.
 */
export function mergePersistFromHomeUrl(
	surface: HomeBrowseSurface,
	params: URLSearchParams,
): void {
	const prev = readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted();
	prev.lastBrowseSurface = surface;
	if (surface === "community") {
		const feed = parseHomeCommunityFeed(params.get("sort"));
		prev.community = {
			feed,
			period: parseHomeCommunityPeriod(params.get("period")),
		};
		writeHomeLobbyPersisted(prev);
		return;
	}
	const sort = parseHomeCatalogSort(params.get("sort"), surface);
	const venue = parseHomeVenue(params.get("venue"), sort);
	if (surface === "tv") {
		const animeSeason = parseHomeAnimeSeason(params.get("animeSeason"));
		prev.tv = {
			sort,
			venue,
			run: parseHomeCatalogRun(params.get("run"), "tv"),
			animeSeason: animeSeason || undefined,
		};
	} else {
		prev.movies = { sort, venue };
	}
	writeHomeLobbyPersisted(prev);
	const href = homeLobbyHrefFromSearchParams(surface, params);
	writeHomeLobbyHrefCookie(href);
}

/** Canonical `/home?…` for the active lobby URL — shared by persistence + cookies. */
export function homeLobbyHrefFromSearchParams(
	surface: HomeBrowseSurface,
	params: URLSearchParams,
): string {
	if (surface === "community") {
		const feed = parseHomeCommunityFeed(params.get("sort"));
		return buildHomeLobbyHref({
			browse: "community",
			sort: feed,
			period: parseHomeCommunityPeriod(params.get("period")),
		});
	}
	const sort = parseHomeCatalogSort(params.get("sort"), surface);
	const venue = parseHomeVenue(params.get("venue"), sort);
	if (surface === "tv") {
		const defVenue = defaultHomeVenueForSort(sort);
		const animeSeason = parseHomeAnimeSeason(params.get("animeSeason"));
		return buildHomeLobbyHref({
			browse: "tv",
			sort,
			venue: venue !== defVenue ? venue : undefined,
			run: parseHomeCatalogRun(params.get("run"), "tv"),
			animeSeason,
		});
	}
	const defVenue = defaultHomeVenueForSort(sort);
	return buildHomeLobbyHref({
		browse: "movies",
		sort,
		venue: venue !== defVenue ? venue : undefined,
	});
}

/** Builds `/home?…` for a browse rail using the last persisted slot (or sensible defaults). */
export function buildHomeHrefFromPersisted(
	persisted: HomeLobbyPersisted,
	surface: HomeBrowseSurface,
): string {
	if (surface === "community") {
		const feed = persisted.community?.feed ?? DEFAULT_HOME_COMMUNITY_FEED;
		return buildHomeLobbyHref({
			browse: "community",
			sort: feed,
			period: persisted.community?.period ?? DEFAULT_HOME_LEADERBOARD_PERIOD,
		});
	}
	if (surface === "tv") {
		const slot = persisted.tv;
		if (!slot) return "/home?browse=tv";
		const defVenue = defaultHomeVenueForSort(slot.sort);
		return buildHomeLobbyHref({
			browse: "tv",
			sort: slot.sort,
			venue: slot.venue !== defVenue ? slot.venue : undefined,
			run: slot.run,
			animeSeason: slot.animeSeason,
		});
	}
	const slot = persisted.movies;
	if (!slot) return "/home";
	const defVenue = defaultHomeVenueForSort(slot.sort);
	return buildHomeLobbyHref({
		browse: "movies",
		sort: slot.sort,
		venue: slot.venue !== defVenue ? slot.venue : undefined,
	});
}

/** Last home browse rail the patron used (defaults to Movies). */
export function readLastHomeBrowseSurface(): HomeBrowseSurface {
	const persisted = readHomeLobbyPersisted();
	const last = persisted?.lastBrowseSurface;
	if (last === "tv" || last === "community" || last === "movies") return last;
	return "movies";
}
