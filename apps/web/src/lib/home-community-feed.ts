/**
 * Community lobby “sort” dimension — maps to `?sort=` when `?browse=community`.
 * (Movies/TV still use {@link import("./home-catalog-sort").HomeCatalogSort}.)
 */
export type HomeCommunityFeed = "lists" | "reviews" | "activity" | "ranks";

/** Ranks slice when `sort=ranks` — film/show diary boards or patron review rank. */
export type HomeCommunityRankKind = "films" | "tv" | "reviews";

export type FilmTvRankKind = "films" | "tv";

export const HOME_COMMUNITY_RANK_KINDS = [
	{ id: "films", label: "Films", title: "Most film diary logs in this period" },
	{
		id: "tv",
		label: "Shows",
		title: "Most show diary logs in this period",
	},
	{
		id: "reviews",
		label: "Reviews",
		title: "Most published reviews in this period",
	},
] as const satisfies readonly {
	id: HomeCommunityRankKind;
	label: string;
	title: string;
}[];

export const DEFAULT_HOME_COMMUNITY_RANK_KIND: HomeCommunityRankKind = "films";

export function isHomeLeaderboardFeed(
	feed: HomeCommunityFeed,
): feed is "ranks" {
	return feed === "ranks";
}

export function isFilmTvRankKind(
	kind: HomeCommunityRankKind,
): kind is FilmTvRankKind {
	return kind === "films" || kind === "tv";
}

export function isMembersRankKind(
	kind: HomeCommunityRankKind,
): kind is "reviews" {
	return kind === "reviews";
}

export function homeCommunityRankKindLabel(
	kind: HomeCommunityRankKind,
): string {
	return (
		HOME_COMMUNITY_RANK_KINDS.find((chip) => chip.id === kind)?.label ?? "Films"
	);
}

export const HOME_COMMUNITY_FEEDS: readonly {
	id: HomeCommunityFeed;
	label: string;
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
		hint: "Patron leaderboards — Films, Shows, or Reviews",
	},
];

export const DEFAULT_HOME_COMMUNITY_FEED: HomeCommunityFeed = "lists";

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
	) {
		return "activity";
	}
	if (
		s === "ranks" ||
		s === "rank" ||
		s === "film-ranks" ||
		s === "film-rank" ||
		s === "films" ||
		s === "tv-ranks" ||
		s === "tv-rank" ||
		s === "members" ||
		s === "member"
	) {
		return "ranks";
	}
	return DEFAULT_HOME_COMMUNITY_FEED;
}

/**
 * Reads `?rank=` when `sort=ranks`. Legacy `?sort=film-ranks|tv-ranks|members` and
 * `?memberSort=` still resolve to a rank slice.
 */
export function parseHomeCommunityRankKind(
	rankParam: string | undefined | null,
	sortParam: string | undefined | null,
	memberSortParam?: string | undefined | null,
): HomeCommunityRankKind {
	const sort = sortParam?.trim().toLowerCase() ?? "";
	if (sort === "members" || sort === "member") {
		return parseMembersRankKindFromParam(memberSortParam);
	}
	if (sort === "tv-ranks" || sort === "tv-rank") return "tv";
	if (sort === "film-ranks" || sort === "film-rank" || sort === "films") {
		return "films";
	}

	if (!rankParam?.trim() && memberSortParam?.trim()) {
		return parseMembersRankKindFromParam(memberSortParam);
	}

	const rank = rankParam?.trim().toLowerCase() ?? "";
	if (rank === "tv" || rank === "shows" || rank === "tv-shows") return "tv";
	if (rank === "films" || rank === "film" || rank === "movies") return "films";
	if (rank === "popular") return "reviews";
	if (rank === "lists" || rank === "list") return "reviews";
	if (rank === "likes" || rank === "like") return "reviews";
	if (rank === "reviews" || rank === "review") return "reviews";
	return DEFAULT_HOME_COMMUNITY_RANK_KIND;
}

function parseMembersRankKindFromParam(
	raw: string | undefined | null,
): HomeCommunityRankKind {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "reviews" || s === "review") return "reviews";
	// Retired patron rank slices — fold into Reviews for now.
	return "reviews";
}
