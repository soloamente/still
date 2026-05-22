"use client";

import { ActivityItem } from "@/components/feed/activity-item";
import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { HomeFriendActivityRail } from "@/components/home/home-friend-activity-rail";
import { ListsLobbyCatalogue } from "@/components/list/lists-lobby-catalogue";
import {
	ReviewCard,
	type ReviewCardListing,
} from "@/components/review/review-card";
import {
	type HomeCommunityActivityItem,
	homeCommunityActivityRowKey,
} from "@/lib/home-community-activity";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeFriendRailEntry } from "@/lib/home-friend-rail";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";

type CommunityReviewCard = {
	id: string;
	userId: string;
	movieId: number;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
	listing?: ReviewCardListing;
};

/**
 * Community browse body on `/home` — lists poster wall, review stack, or activity feed.
 */
export function HomeCommunityLobby({
	feed,
	listSeeds,
	reviews,
	activityItems,
	friendRailEntries,
	monochromePeersOnHover,
	signedIn,
}: {
	feed: HomeCommunityFeed;
	listSeeds: ListLobbySeed[];
	reviews: CommunityReviewCard[];
	activityItems: HomeCommunityActivityItem[];
	friendRailEntries: HomeFriendRailEntry[];
	monochromePeersOnHover: boolean;
	signedIn: boolean;
}) {
	const catalogueWaveKey = `community:${feed}`;

	if (feed === "lists") {
		if (listSeeds.length === 0) {
			return (
				<HomeCommunityEmpty
					title="No public lists yet"
					description="When members publish lists, they show up here — curated lanes, top tens, and shared canons."
					primaryHref={signedIn ? "/lists/new" : "/sign-up"}
					primaryLabel={signedIn ? "Create a list" : "Join Still"}
					secondaryHref={buildHomeLobbyHref({
						browse: "movies",
						sort: "popular",
					})}
					secondaryLabel="Browse movies"
				/>
			);
		}
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<ListsLobbyCatalogue
					seeds={listSeeds}
					catalogueWaveKeyOverride={catalogueWaveKey}
					monochromePeersOnHover={monochromePeersOnHover}
				/>
			</div>
		);
	}

	if (feed === "reviews") {
		if (reviews.length === 0) {
			return (
				<HomeCommunityEmpty
					title="No published reviews yet"
					description="Written reviews from the community land here once members publish from a film page."
					primaryHref={buildHomeLobbyHref({
						browse: "movies",
						sort: "popular",
					})}
					primaryLabel="Browse movies"
					secondaryHref="/diary"
					secondaryLabel="Your diary"
				/>
			);
		}
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
					{reviews.map((review) => (
						<li key={review.id}>
							<ReviewCard review={review} />
						</li>
					))}
				</ul>
			</div>
		);
	}

	// Activity — following feed when signed in, otherwise platform discover highlights.
	if (activityItems.length === 0) {
		return (
			<HomeCommunityEmpty
				title={
					signedIn
						? "Nothing from your circle yet"
						: "Sign in to see friend activity"
				}
				description={
					signedIn
						? "Follow people whose logs and lists you want here — the feed lights up as soon as they post."
						: "Your following feed shows logs, reviews, and lists from people you follow. Browse public highlights after you join."
				}
				primaryHref={signedIn ? "/home" : "/sign-in"}
				primaryLabel={signedIn ? "Discover members" : "Sign in"}
				secondaryHref={buildHomeLobbyHref({
					browse: "movies",
					sort: "popular",
				})}
				secondaryLabel="Browse movies"
			/>
		);
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
			<div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
					{activityItems.map((item) => (
						<li key={homeCommunityActivityRowKey(item)}>
							<ActivityItem item={item} />
						</li>
					))}
				</ul>
			</div>
			{friendRailEntries.length > 0 ? (
				<HomeFriendActivityRail entries={friendRailEntries} />
			) : null}
		</div>
	);
}
