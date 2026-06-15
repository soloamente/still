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
 * Films · Shows · Reviews — centered rail on Community Ranks.
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
		<div
			className={cn(
				"min-w-0 shrink-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
				className,
			)}
		>
			<SegmentedPillToolbar
				layoutId={layoutId}
				aria-label="Rankings"
				compact
				value={rankKind}
				onChange={(next: HomeCommunityRankKind) => selectRankKind(next)}
				options={HOME_COMMUNITY_RANK_KINDS}
			/>
		</div>
	);
}

export function homeCommunityRankKindSectionLabel(
	rankKind: HomeCommunityRankKind,
): string {
	return homeCommunityRankKindLabel(rankKind);
}
