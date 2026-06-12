"use client";

import { HomeCommunityPeriodToolbar } from "@/components/home/home-community-period-toolbar";
import { HomeCommunityRankKindToolbar } from "@/components/home/home-community-rank-kind-toolbar";

/**
 * Right rail on Community browse — Films/TV when Ranks is active, then period window.
 */
export function HomeCommunityTrailingToolbar() {
	return (
		<>
			<HomeCommunityRankKindToolbar />
			<HomeCommunityPeriodToolbar />
		</>
	);
}
