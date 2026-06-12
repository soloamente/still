"use client";

import { cn } from "@still/ui/lib/utils";

import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import {
	HOME_COMMUNITY_RANK_KINDS,
	type HomeCommunityRankKind,
	homeCommunityRankKindLabel,
	isHomeLeaderboardFeed,
} from "@/lib/home-community-feed";

/**
 * Films · TV — right-rail slice when Community sort is Ranks (desktop inline).
 * Mobile uses the filters popover in {@link HomeCommunityPeriodToolbar}.
 */
export function HomeCommunityRankKindToolbar({
	className,
	layoutId = "home-community-rank-kind-pill",
}: {
	className?: string;
	layoutId?: string;
}) {
	const { feed, rankKind, selectRankKind } = useHomeCommunityLobbyParams();

	if (!isHomeLeaderboardFeed(feed)) return null;

	return (
		<div className={cn("hidden shrink-0 sm:block", className)}>
			<SegmentedPillToolbar
				layoutId={layoutId}
				aria-label="Rankings catalogue"
				compact
				value={rankKind}
				onChange={(next: HomeCommunityRankKind) => selectRankKind(next)}
				options={HOME_COMMUNITY_RANK_KINDS}
			/>
		</div>
	);
}

/** Mobile filters panel copy for the rank-kind section. */
export function homeCommunityRankKindSectionLabel(
	rankKind: HomeCommunityRankKind,
): string {
	return homeCommunityRankKindLabel(rankKind);
}
