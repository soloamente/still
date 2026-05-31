import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import { parseHomeBrowseSurface } from "@/lib/home-browse-surface";
import { DEFAULT_HOME_COMMUNITY_FEED } from "@/lib/home-community-feed";
import { DEFAULT_HOME_LEADERBOARD_PERIOD } from "@/lib/home-leaderboard-period";
import {
	buildHomeHrefFromPersisted,
	emptyHomeLobbyPersisted,
	type HomeLobbyPersisted,
	readHomeLobbyPersisted,
} from "@/lib/home-lobby-persist";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/**
 * Builds the navigation target when the patron picks a browse rail (Movies / TV / Community).
 * Mirrors {@link HomeStickyChrome} `pushBrowseSurface` so tests and the client provider stay aligned.
 */
export function buildBrowseSurfaceNavigateHref(
	next: HomeBrowseSurface,
	input: {
		isHomeLobby: boolean;
		currentParams: URLSearchParams;
		persisted?: HomeLobbyPersisted | null;
	},
): string {
	const persisted =
		input.persisted ?? readHomeLobbyPersisted() ?? emptyHomeLobbyPersisted();

	if (!input.isHomeLobby) {
		return buildHomeHrefFromPersisted(persisted, next);
	}

	if (next === "community") {
		const feed = persisted.community?.feed ?? DEFAULT_HOME_COMMUNITY_FEED;
		return buildHomeLobbyHref({
			browse: "community",
			sort: feed,
			period: persisted.community?.period ?? DEFAULT_HOME_LEADERBOARD_PERIOD,
		});
	}

	const currentBrowse = parseHomeBrowseSurface(
		input.currentParams.get("browse"),
	);
	if (currentBrowse === "community") {
		return buildHomeHrefFromPersisted(persisted, next);
	}

	const params = new URLSearchParams(input.currentParams.toString());
	if (next === "movies") {
		params.delete("browse");
	} else {
		params.set("browse", next);
	}
	const qs = params.toString();
	return qs ? `/home?${qs}` : "/home";
}
