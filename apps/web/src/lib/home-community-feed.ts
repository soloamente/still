/**
 * Community lobby “sort” dimension — maps to `?sort=` when `?browse=community`.
 * (Movies/TV still use {@link import("./home-catalog-sort").HomeCatalogSort}.)
 */
export type HomeCommunityFeed = "lists" | "reviews" | "activity" | "ranks";

/** Film vs TV diary logs when `sort=ranks` — `?rank=` on the URL. */
export type HomeCommunityRankKind = "films" | "tv";

export const HOME_COMMUNITY_RANK_KINDS = [
	{ id: "films", label: "Films" },
	{ id: "tv", label: "TV" },
] as const satisfies readonly { id: HomeCommunityRankKind; label: string }[];

export const DEFAULT_HOME_COMMUNITY_RANK_KIND: HomeCommunityRankKind = "films";

export function isHomeLeaderboardFeed(
	feed: HomeCommunityFeed,
): feed is "ranks" {
	return feed === "ranks";
}

export function homeCommunityRankKindLabel(
	kind: HomeCommunityRankKind,
): string {
	return kind === "tv" ? "TV" : "Films";
}

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
	{
		id: "ranks",
		label: "Ranks",
		hint: "Patrons ranked by diary logs in this period — switch Films or TV on the right",
	},
];

/** Default community tab — matches omitted `sort` in {@link buildHomeLobbyHref}. */
export const DEFAULT_HOME_COMMUNITY_FEED: HomeCommunityFeed = "lists";

/**
 * Reads `?sort=` for the community lobby. TMDb values (`latest`, `popular`) normalize
 * to {@link DEFAULT_HOME_COMMUNITY_FEED} when users switch from Movies/TV.
 *
 * Legacy `film-ranks` / `tv-ranks` normalize to `ranks` — pair with
 * {@link parseHomeCommunityRankKind} for the film/TV slice.
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
	if (
		s === "ranks" ||
		s === "rank" ||
		s === "film-ranks" ||
		s === "film-rank" ||
		s === "films" ||
		s === "tv-ranks" ||
		s === "tv-rank"
	) {
		return "ranks";
	}
	return DEFAULT_HOME_COMMUNITY_FEED;
}

/**
 * Reads `?rank=` when `sort=ranks`. Legacy `?sort=film-ranks|tv-ranks` still imply kind.
 */
export function parseHomeCommunityRankKind(
	rankParam: string | undefined | null,
	sortParam: string | undefined | null,
): HomeCommunityRankKind {
	const sort = sortParam?.trim().toLowerCase() ?? "";
	if (sort === "tv-ranks" || sort === "tv-rank") return "tv";
	if (sort === "film-ranks" || sort === "film-rank" || sort === "films") {
		return "films";
	}

	const rank = rankParam?.trim().toLowerCase() ?? "";
	if (rank === "tv" || rank === "shows" || rank === "tv-shows") return "tv";
	return DEFAULT_HOME_COMMUNITY_RANK_KIND;
}
