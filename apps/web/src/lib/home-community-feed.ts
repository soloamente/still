/**
 * Community lobby “sort” dimension — maps to `?sort=` when `?browse=community`.
 * (Movies/TV still use {@link import("./home-catalog-sort").HomeCatalogSort}.)
 */
export type HomeCommunityFeed = "lists" | "reviews" | "activity";

export const HOME_COMMUNITY_FEEDS: readonly {
	id: HomeCommunityFeed;
	/** Short chip label */
	label: string;
	/** Tooltip + screen-reader context */
	hint: string;
}[] = [
	{
		id: "lists",
		label: "Lists",
		hint: "Member-made lists of titles",
	},
	{
		id: "reviews",
		label: "Reviews",
		hint: "Written reviews from the community",
	},
	{
		id: "activity",
		label: "Activity",
		hint: "Watch logs, reviews, and lists from people you follow",
	},
];

/** Default community tab — matches omitted `sort` in {@link buildHomeLobbyHref}. */
export const DEFAULT_HOME_COMMUNITY_FEED: HomeCommunityFeed = "lists";

/**
 * Reads `?sort=` for the community lobby. TMDb values (`latest`, `popular`) normalize
 * to {@link DEFAULT_HOME_COMMUNITY_FEED} when users switch from Movies/TV.
 */
export function parseHomeCommunityFeed(
	raw: string | undefined | null,
): HomeCommunityFeed {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "reviews" || s === "review") return "reviews";
	if (
		s === "activity" ||
		s === "feed" ||
		s === "following" ||
		s === "diary" ||
		s === "diaries" ||
		s === "logs" ||
		s === "log"
	)
		return "activity";
	return DEFAULT_HOME_COMMUNITY_FEED;
}
