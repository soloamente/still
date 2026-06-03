"use client";

import { useCallback, useMemo } from "react";

import { ActivityItem } from "@/components/feed/activity-item";
import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { HomeFriendActivityRail } from "@/components/home/home-friend-activity-rail";
import {
	type HomeCommunityActivityItem,
	homeCommunityActivityRowKey,
	parseFeedApiActivityItems,
} from "@/lib/home-community-activity";
import { deriveFriendRailEntries } from "@/lib/home-friend-rail";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	COMMUNITY_ACTIVITY_LIMIT,
	fetchCommunityActivity,
} from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function CommunityActivityInfinite({
	seeds,
	initialCursor,
	period,
	signedIn,
}: {
	seeds: HomeCommunityActivityItem[];
	initialCursor: string | null;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
}) {
	const loadMore = useCallback(
		async (before: string, signal: AbortSignal) => {
			const payload = await fetchCommunityActivity(
				period,
				readViewerTimeZone(),
				signedIn,
				{ before, signal },
			);
			if (payload == null) return { error: true as const };
			const items = parseFeedApiActivityItems(payload);
			const last = items[items.length - 1];
			return {
				items,
				nextCursor:
					items.length >= COMMUNITY_ACTIVITY_LIMIT && last ? last.at : null,
			};
		},
		[period, signedIn],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		HomeCommunityActivityItem,
		string
	>({
		seeds,
		initialCursor,
		loadMore,
		getKey: homeCommunityActivityRowKey,
	});

	const friendRailEntries = useMemo(
		() => deriveFriendRailEntries(items),
		[items],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
					{items.map((item) => (
						<li key={homeCommunityActivityRowKey(item)}>
							<ActivityItem item={item} />
						</li>
					))}
				</ul>
				<CommunityInfiniteFooter
					footerState={footerState}
					sentinelRef={sentinelRef}
					retry={retry}
					loadingLabel="Loading more activity"
				/>
			</div>
			{friendRailEntries.length > 0 ? (
				<HomeFriendActivityRail entries={friendRailEntries} />
			) : null}
		</div>
	);
}
