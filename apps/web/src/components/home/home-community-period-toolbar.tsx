"use client";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { HomeLobbyChipPopover } from "@/components/home/home-lobby-chip-popover";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	HOME_LEADERBOARD_PERIODS,
	type HomeLeaderboardPeriod,
	leaderboardPeriodLabel,
} from "@/lib/home-leaderboard-period";

/**
 * Week / Month / Year / All time — sits on the right of Community feed chips (mirrors
 * Movies/TV venue rail). Filters bundled community payloads locally for instant taps.
 */
export function HomeCommunityPeriodToolbar() {
	const { period, selectPeriod } = useHomeCommunityLobbyParams();

	return (
		<>
			{/* Desktop — inline pill rail */}
			<div className="hidden shrink-0 sm:block">
				<SegmentedPillToolbar
					layoutId="home-community-period-pill"
					aria-label="Community period"
					compact
					value={period}
					onChange={(next: HomeLeaderboardPeriod) => selectPeriod(next)}
					options={HOME_LEADERBOARD_PERIODS}
				/>
			</div>
			{/* Mobile — compact popover when the row cannot fit both toolbars */}
			<div className="shrink-0 sm:hidden">
				<HomeLobbyChipPopover
					aria-label="Community period"
					title="Filter community content by time period"
					layoutId="home-community-period-pill-mobile"
					value={period}
					triggerLabel={leaderboardPeriodLabel(period)}
					options={HOME_LEADERBOARD_PERIODS}
					onChange={(next) => selectPeriod(next)}
				/>
			</div>
		</>
	);
}
