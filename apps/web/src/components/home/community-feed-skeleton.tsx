"use client";

import { ShimmerBone } from "@still/ui/components/skeleton-shimmer";
import { cn } from "@still/ui/lib/utils";

import { CommunityRanksSkeleton } from "@/components/home/community-ranks-skeleton";
import { HomeCommunityLobbyScroll } from "@/components/home/home-community-lobby-scroll";
import {
	type HomeCommunityFeed,
	isHomeLeaderboardFeed,
} from "@/lib/home-community-feed";
import {
	HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
	HOME_COMMUNITY_FEED_LIST_CLASSNAME,
} from "@/lib/home-community-lobby-layout";
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
		<HomeCommunityLobbyScroll contentKey="community-lists-skeleton">
			<div className={HOME_LOBBY_CATALOGUE_GRID_CLASSNAME}>
				{COMMUNITY_LIST_POSTER_SKELETON_KEYS.map((posterKey) => (
					<ShimmerBone
						key={`community-lists-skel-poster-${posterKey}`}
						className="aspect-2/3 w-full rounded-[3rem] bg-background"
						aria-hidden
					/>
				))}
			</div>
		</HomeCommunityLobbyScroll>
	);
}

function CommunityFeedRowSkeleton({ label }: { label: string }) {
	return (
		<HomeCommunityLobbyScroll contentKey="community-feed-row-skeleton">
			<p className="sr-only">{label}</p>
			<ul
				className={cn(
					HOME_COMMUNITY_FEED_COLUMN_CLASSNAME,
					HOME_COMMUNITY_FEED_LIST_CLASSNAME,
				)}
				aria-busy
				aria-live="polite"
			>
				{COMMUNITY_FEED_ROW_SKELETON_KEYS.map((rowKey) => (
					<li key={`community-feed-row-skel-${rowKey}`}>
						<ShimmerBone
							className="h-40 w-full rounded-[1.75rem] bg-background"
							aria-hidden
						/>
					</li>
				))}
			</ul>
		</HomeCommunityLobbyScroll>
	);
}

/**
 * Body placeholder while an optimistic Community tab/period change waits on RSC.
 */
export function CommunityFeedSkeleton({ feed }: { feed: HomeCommunityFeed }) {
	if (isHomeLeaderboardFeed(feed)) {
		return (
			<HomeCommunityLobbyScroll>
				<CommunityRanksSkeleton />
			</HomeCommunityLobbyScroll>
		);
	}

	if (feed === "lists") {
		return (
			<div aria-busy aria-live="polite">
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
