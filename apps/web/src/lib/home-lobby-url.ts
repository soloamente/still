import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import type { HomeCatalogRun } from "@/lib/home-catalog-run";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import { DEFAULT_HOME_COMMUNITY_FEED } from "@/lib/home-community-feed";
import {
	DEFAULT_HOME_LEADERBOARD_PERIOD,
	type HomeLeaderboardPeriod,
} from "@/lib/home-leaderboard-period";
import { defaultHomeVenueForSort, type HomeVenue } from "@/lib/home-venue";

/** Serialize `?animeSeason=1` for the TV seasonal anime slice (SN.17.2). */
export function serializeHomeAnimeSeason(active: boolean): string | undefined {
	return active ? "1" : undefined;
}

/** Venue default for URL shortening — TV **Upcoming** run defaults to In cinemas. */
function defaultVenueForLobbyHref(input: {
	browse: HomeBrowseSurface;
	sort: HomeCatalogSort | HomeCommunityFeed;
	run?: HomeCatalogRun | null;
}): HomeVenue {
	if (input.browse === "tv" && input.run === "upcoming") return "theaters";
	return defaultHomeVenueForSort(input.sort as HomeCatalogSort);
}

/**
 * Builds `/home` links that preserve browse rail (Movies ↔ TV ↔ Community) and the
 * active sort dimension: TMDb **Latest / Popular** on catalogue surfaces (TV **Upcoming** uses `run`), or
 * **community feeds** (lists, reviews, …) when `browse=community`.
 *
 * Optional **`venue`** (theatrical vs at-home digital) is only serialized when it
 * differs from the implicit default for the target `sort` so URLs stay short.
 */
export function buildHomeLobbyHref(input: {
	browse: HomeBrowseSurface;
	sort: HomeCatalogSort | HomeCommunityFeed;
	/** Theatrical vs streaming-at-home emphasis — movies/TV catalogue only. */
	venue?: HomeVenue;
	/** TV slice — `ongoing`, `completed`, or `upcoming`; omit for Popular/Latest only. */
	run?: HomeCatalogRun | null;
	/** TV seasonal anime discover — animation genre + returning + rolling 90d first air. */
	animeSeason?: boolean;
	/** Time window for Community tabs (`lists`, `activity`, ranks, …). */
	period?: HomeLeaderboardPeriod;
}): string {
	const params = new URLSearchParams();

	if (input.browse === "community") {
		params.set("browse", "community");
		const feed = input.sort as HomeCommunityFeed;
		if (feed !== DEFAULT_HOME_COMMUNITY_FEED) {
			params.set("sort", feed);
		}
		const period = input.period ?? DEFAULT_HOME_LEADERBOARD_PERIOD;
		if (period !== DEFAULT_HOME_LEADERBOARD_PERIOD) {
			params.set("period", period);
		}
	} else {
		if (input.browse === "tv") {
			params.set("browse", "tv");
		}
		const catalogSort = input.sort as HomeCatalogSort;
		/** TV **Upcoming** is `?run=upcoming`, not `?sort=upcoming`. */
		if (input.browse === "tv" && catalogSort === "upcoming") {
			params.set("run", "upcoming");
			params.set("sort", "popular");
		} else {
			// Always serialize `sort` — bare `/home` would otherwise restore `still.home-lobby-href-v1`
			// from the previous chip (e.g. Popular) while the Latest chip reads as active.
			if (catalogSort === "popular") {
				params.set("sort", "popular");
			} else if (catalogSort === "latest") {
				params.set("sort", "latest");
			} else if (catalogSort === "upcoming") {
				params.set("sort", "upcoming");
			}
			if (input.browse === "tv" && input.run) {
				params.set("run", input.run);
			}
			const animeSeason = serializeHomeAnimeSeason(Boolean(input.animeSeason));
			if (animeSeason) {
				params.set("animeSeason", animeSeason);
			}
		}
		if (
			(input.browse === "movies" || input.browse === "tv") &&
			input.venue !== undefined
		) {
			const def = defaultVenueForLobbyHref(input);
			if (input.venue !== def) {
				params.set("venue", input.venue);
			}
		}
	}

	const qs = params.toString();
	return qs ? `/home?${qs}` : "/home";
}
