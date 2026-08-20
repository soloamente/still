import type { HomeCommunityActivityScope } from "@/lib/home-community-activity-scope";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { leaderboardPeriodLabel } from "@/lib/home-leaderboard-period";

/** Subsection label above the Community activity feed. */
export function formatCommunityActivityHeader(input: {
	scope: HomeCommunityActivityScope;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
}): string {
	const periodLabel = leaderboardPeriodLabel(input.period).toLowerCase();
	const periodSuffix = input.period === "all" ? "" : ` this ${periodLabel}`;

	if (!input.signedIn || input.scope === "discover") {
		return `Public activity${periodSuffix}`;
	}
	return `From people you follow${periodSuffix}`;
}
