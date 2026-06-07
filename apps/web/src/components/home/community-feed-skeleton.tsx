"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";

import { CommunityRanksSkeleton } from "@/components/home/community-ranks-skeleton";
import {
	type HomeCommunityFeed,
	isHomeLeaderboardFeed,
} from "@/lib/home-community-feed";
import { HOME_LOBBY_CATALOGUE_GRID_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";

const COMMUNITY_LIST_POSTER_SKELETON_KEYS = [
	"p01",
	"p02",
	"p03",
	"p04",
	"p05",
	"p06",
	"p07",
	"p08",
	"p09",
	"p10",
	"p11",
	"p12",
] as const;

const COMMUNITY_FEED_ROW_SKELETON_KEYS = [
	"row-a",
	"row-b",
	"row-c",
	"row-d",
	"row-e",
	"row-f",
] as const;

function CommunityListsFeedSkeleton() {
	return (
		<div
			className={`min-h-0 flex-1 px-0.5 pb-2 ${HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}`}
		>
			{COMMUNITY_LIST_POSTER_SKELETON_KEYS.map((posterKey) => (
				<ShimmerBone
					key={`community-lists-skel-poster-${posterKey}`}
					className="aspect-2/3 w-full rounded-[3rem] bg-background"
					aria-hidden
				/>
			))}
		</div>
	);
}

/** Feed-row silhouette — activity + reviews share the same max-width stack. */
function CommunityFeedRowSkeleton({ label }: { label: string }) {
	return (
		<div
			className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2"
			aria-busy
			aria-live="polite"
		>
			<p className="sr-only">{label}</p>
			<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
				{COMMUNITY_FEED_ROW_SKELETON_KEYS.map((rowKey) => (
					<li key={`community-feed-row-skel-${rowKey}`}>
						<ShimmerBone
							className="h-24 w-full rounded-2xl bg-background"
							aria-hidden
						/>
					</li>
				))}
			</ul>
		</div>
	);
}

/**
 * Body placeholder while an optimistic Community tab/period change waits on RSC.
 */
export function CommunityFeedSkeleton({ feed }: { feed: HomeCommunityFeed }) {
	if (isHomeLeaderboardFeed(feed)) {
		return <CommunityRanksSkeleton />;
	}

	if (feed === "lists") {
		return (
			<div className="min-h-0 flex-1" aria-busy aria-live="polite">
				<p className="sr-only">Loading lists…</p>
				<CommunityListsFeedSkeleton />
			</div>
		);
	}

	if (feed === "reviews") {
		return <CommunityFeedRowSkeleton label="Loading reviews…" />;
	}

	return <CommunityFeedRowSkeleton label="Loading activity…" />;
}
