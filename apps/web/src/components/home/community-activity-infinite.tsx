"use client";

import { cn } from "@still/ui/lib/utils";
import { useCallback, useMemo } from "react";

import { ActivityItem } from "@/components/feed/activity-item";
import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import {
	type ActivityFeedCursor,
	activityFeedCursorFromItem,
	type HomeCommunityActivityItem,
	homeCommunityActivityRowKey,
	parseFeedApiActivityItems,
	sortActivityItems,
} from "@/lib/home-community-activity";
import {
	HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
	HOME_COMMUNITY_FEED_LIST_CLASSNAME,
} from "@/lib/home-community-lobby-layout";
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
	/** When false, render the bounded discover snapshot only (no load-more). */
	paginate,
}: {
	seeds: HomeCommunityActivityItem[];
	initialCursor: ActivityFeedCursor | null;
	period: HomeLeaderboardPeriod;
	paginate: boolean;
}) {
	const sortedSeeds = useMemo(() => sortActivityItems(seeds), [seeds]);

	const loadMore = useCallback(
		async (cursor: ActivityFeedCursor, signal: AbortSignal) => {
			const payload = await fetchCommunityActivity(
				period,
				readViewerTimeZone(),
				true,
				{
					before: cursor.before,
					beforeKind: cursor.beforeKind,
					beforeId: cursor.beforeId,
					signal,
				},
			);
			if (payload == null) return { error: true as const };
			const items = sortActivityItems(parseFeedApiActivityItems(payload));
			const last = items[items.length - 1];
			return {
				items,
				nextCursor:
					items.length >= COMMUNITY_ACTIVITY_LIMIT && last
						? activityFeedCursorFromItem(last)
						: null,
			};
		},
		[period],
	);

	const {
		items: rawItems,
		footerState,
		sentinelRef,
		retry,
	} = useInfinitePager<HomeCommunityActivityItem, ActivityFeedCursor>({
		seeds: sortedSeeds,
		initialCursor: paginate ? initialCursor : null,
		loadMore: paginate
			? loadMore
			: async () => ({ items: [], nextCursor: null }),
		getKey: homeCommunityActivityRowKey,
	});

	const items = useMemo(() => sortActivityItems(rawItems), [rawItems]);

	const listClassName = cn(
		HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
		HOME_COMMUNITY_FEED_LIST_CLASSNAME,
	);

	return (
		<>
			<ul className={listClassName}>
				{items.map((item) => (
					<li key={homeCommunityActivityRowKey(item)}>
						<ActivityItem item={item} variant="community" />
					</li>
				))}
			</ul>
			{paginate ? (
				<div className={HOME_COMMUNITY_FEED_COLUMN_CLASSNAME}>
					<CommunityInfiniteFooter
						footerState={footerState}
						sentinelRef={sentinelRef}
						retry={retry}
						loadingLabel="Loading more activity"
					/>
				</div>
			) : null}
		</>
	);
}
