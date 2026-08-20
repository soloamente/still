"use client";

import { cn } from "@still/ui/lib/utils";
import { useCallback } from "react";

import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { CommunityReviewFeedRow } from "@/components/home/community-review-feed-row";
import {
	type HomeCommunityReviewRow,
	mapCommunityReviewRow,
} from "@/lib/home-community-core-fetch";
import {
	HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
	HOME_COMMUNITY_FEED_LIST_CLASSNAME,
} from "@/lib/home-community-lobby-layout";
import type { HomeCommunityReviewSort } from "@/lib/home-community-review-sort";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	COMMUNITY_REVIEWS_LIMIT,
	fetchCommunityReviewsRecent,
} from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function CommunityReviewsInfinite({
	seeds,
	initialCursor,
	period,
	reviewSort = "all",
}: {
	seeds: HomeCommunityReviewRow[];
	initialCursor: number | null;
	period: HomeLeaderboardPeriod;
	reviewSort?: HomeCommunityReviewSort;
}) {
	const topRated = reviewSort === "most-liked";
	const order = topRated ? "engagement" : "chronological";

	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const raw = await fetchCommunityReviewsRecent(
				period,
				readViewerTimeZone(),
				{ page, order, signal },
			);
			if (raw == null) return { error: true as const };
			const items = raw
				.map(mapCommunityReviewRow)
				.filter((r): r is HomeCommunityReviewRow => r != null);
			return {
				items,
				nextCursor: raw.length >= COMMUNITY_REVIEWS_LIMIT ? page + 1 : null,
			};
		},
		[order, period],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		HomeCommunityReviewRow,
		number
	>({
		seeds,
		initialCursor,
		loadMore,
		getKey: (r) => r.id,
	});

	const listClassName = cn(
		HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
		HOME_COMMUNITY_FEED_LIST_CLASSNAME,
	);

	return (
		<>
			<ul className={listClassName}>
				{items.map((review) => (
					<li key={review.id}>
						<CommunityReviewFeedRow review={review} />
					</li>
				))}
			</ul>
			<div className={HOME_COMMUNITY_FEED_COLUMN_CLASSNAME}>
				<CommunityInfiniteFooter
					footerState={footerState}
					sentinelRef={sentinelRef}
					retry={retry}
					loadingLabel={
						topRated ? "Loading more top rated reviews" : "Loading more reviews"
					}
				/>
			</div>
		</>
	);
}
