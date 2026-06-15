/** Reviews tab sub-sort on `/home?browse=community&sort=reviews`. */
export type HomeCommunityReviewSort = "all" | "most-liked";

export const DEFAULT_HOME_COMMUNITY_REVIEW_SORT: HomeCommunityReviewSort =
	"all";

export function parseHomeCommunityReviewSort(
	raw: string | undefined | null,
): HomeCommunityReviewSort {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "most-liked" || s === "most_liked" || s === "viral") {
		return "most-liked";
	}
	return DEFAULT_HOME_COMMUNITY_REVIEW_SORT;
}

export function serializeHomeCommunityReviewSort(
	sort: HomeCommunityReviewSort,
): string | undefined {
	return sort === "most-liked" ? "most-liked" : undefined;
}
