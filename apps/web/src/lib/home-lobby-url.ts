import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import { DEFAULT_HOME_COMMUNITY_FEED } from "@/lib/home-community-feed";

/**
 * Builds `/home` links that preserve browse rail (Movies ↔ TV ↔ Community) and the
 * active sort dimension: TMDb **Latest/Popular** on catalogue surfaces, or
 * **community feeds** (lists, reviews, …) when `browse=community`.
 */
export function buildHomeLobbyHref(input: {
	browse: HomeBrowseSurface;
	sort: HomeCatalogSort | HomeCommunityFeed;
}): string {
	const params = new URLSearchParams();

	if (input.browse === "community") {
		params.set("browse", "community");
		const feed = input.sort as HomeCommunityFeed;
		if (feed !== DEFAULT_HOME_COMMUNITY_FEED) {
			params.set("sort", feed);
		}
	} else {
		if (input.browse === "tv") {
			params.set("browse", "tv");
		}
		const catalogSort = input.sort as HomeCatalogSort;
		if (catalogSort === "popular") {
			params.set("sort", "popular");
		}
	}

	const qs = params.toString();
	return qs ? `/home?${qs}` : "/home";
}
