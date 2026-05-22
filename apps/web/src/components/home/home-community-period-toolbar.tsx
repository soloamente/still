"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { parseHomeCommunityFeed } from "@/lib/home-community-feed";
import {
	HOME_LEADERBOARD_PERIODS,
	type HomeLeaderboardPeriod,
	parseHomeCommunityPeriod,
} from "@/lib/home-leaderboard-period";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/**
 * Week / Month / Year / All time — sits on the right of Community feed chips (mirrors
 * Movies/TV venue rail). URL-backed for every Community tab.
 */
export function HomeCommunityPeriodToolbar() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const feed = parseHomeCommunityFeed(searchParams.get("sort"));
	const period = parseHomeCommunityPeriod(searchParams.get("period"));

	return (
		<div className="shrink-0">
			<SegmentedPillToolbar
				layoutId="home-community-period-pill"
				aria-label="Community period"
				compact
				value={period}
				onChange={(next: HomeLeaderboardPeriod) => {
					router.replace(
						buildHomeLobbyHref({
							browse: "community",
							sort: feed,
							period: next,
						}),
						{ scroll: false },
					);
				}}
				options={HOME_LEADERBOARD_PERIODS}
			/>
		</div>
	);
}
