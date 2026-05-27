"use client";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	HOME_LEADERBOARD_PERIODS,
	type HomeLeaderboardPeriod,
} from "@/lib/home-leaderboard-period";

/**
 * Week / Month / Year / All time — sits on the right of Community feed chips (mirrors
 * Movies/TV venue rail). Filters bundled community payloads locally for instant taps.
 */
export function HomeCommunityPeriodToolbar() {
	const { period, selectPeriod } = useHomeCommunityLobbyParams();

	return (
		<div className="shrink-0">
			<SegmentedPillToolbar
				layoutId="home-community-period-pill"
				aria-label="Community period"
				compact
				value={period}
				onChange={(next: HomeLeaderboardPeriod) => selectPeriod(next)}
				options={HOME_LEADERBOARD_PERIODS}
			/>
		</div>
	);
}
