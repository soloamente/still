"use client";

import { useCallback } from "react";

import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { ReviewCard } from "@/components/review/review-card";
import {
	type HomeCommunityReviewRow,
	mapCommunityReviewRow,
} from "@/lib/home-community-core-fetch";
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
}: {
	seeds: HomeCommunityReviewRow[];
	initialCursor: number | null;
	period: HomeLeaderboardPeriod;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const raw = await fetchCommunityReviewsRecent(
				period,
				readViewerTimeZone(),
				{ page, signal },
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
		[period],
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

	return (
		<>
			<p className="mx-auto mb-4 max-w-2xl text-center text-muted-foreground text-xs leading-relaxed">
				Ranked by likes and replies in this period — not review length.
			</p>
			<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
				{items.map((review) => (
					<li key={review.id}>
						<ReviewCard review={review} />
					</li>
				))}
			</ul>
			<CommunityInfiniteFooter
				footerState={footerState}
				sentinelRef={sentinelRef}
				retry={retry}
				loadingLabel="Loading more reviews"
			/>
		</>
	);
}
