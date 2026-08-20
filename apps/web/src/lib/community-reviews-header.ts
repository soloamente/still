import type { HomeCommunityReviewSort } from "@/lib/home-community-review-sort";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { leaderboardPeriodLabel } from "@/lib/home-leaderboard-period";

/** Subsection label above the Community reviews feed. */
export function formatCommunityReviewsHeader(input: {
	sort: HomeCommunityReviewSort;
	period: HomeLeaderboardPeriod;
}): string {
	const periodLabel = leaderboardPeriodLabel(input.period).toLowerCase();
	const periodSuffix = input.period === "all" ? "" : ` this ${periodLabel}`;

	if (input.sort === "most-liked") {
		return `Top rated reviews${periodSuffix}`;
	}
	return `Latest reviews${periodSuffix}`;
}
