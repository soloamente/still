import type { HomeBrowseSurface } from "@/lib/home-browse-surface";
import type { HomeCatalogSort } from "@/lib/home-catalog-sort";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import { DEFAULT_HOME_COMMUNITY_FEED } from "@/lib/home-community-feed";
import { defaultHomeVenueForSort, type HomeVenue } from "@/lib/home-venue";

/**
 * Builds `/home` links that preserve browse rail (Movies ↔ TV ↔ Community) and the
 * active sort dimension: TMDb **Upcoming / Latest / Popular** on catalogue surfaces, or
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
		} else if (catalogSort === "upcoming") {
			params.set("sort", "upcoming");
		}
		if (
			(input.browse === "movies" || input.browse === "tv") &&
			input.venue !== undefined
		) {
			const def = defaultHomeVenueForSort(catalogSort);
			if (input.venue !== def) {
				params.set("venue", input.venue);
			}
		}
	}

	const qs = params.toString();
	return qs ? `/home?${qs}` : "/home";
}
