"use client";

import { Button } from "@still/ui/components/button";

import { CommunityActivityInfinite } from "@/components/home/community-activity-infinite";
import { CommunityListsInfinite } from "@/components/home/community-lists-infinite";
import { CommunityRanksSkeleton } from "@/components/home/community-ranks-skeleton";
import { CommunityReviewsInfinite } from "@/components/home/community-reviews-infinite";
import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { HomeCommunityLeaderboard } from "@/components/home/home-community-leaderboard";
import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { HomeCuratorSpotlights } from "@/components/home/home-curator-spotlights";
import { HomeEditorialHighlights } from "@/components/home/home-editorial-highlights";
import { APP_NAME } from "@/lib/app-brand";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import {
	type HomeCommunityFeed,
	type HomeCommunityRankKind,
	isHomeLeaderboardFeed,
} from "@/lib/home-community-feed";
import {
	type HomeLeaderboardPeriod,
	leaderboardPeriodLabel,
} from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

function HomeCommunityLobbyRanksFallback({
	periodLabel,
	signedIn,
}: {
	periodLabel: string;
	signedIn: boolean;
}) {
	const {
		leaderboardsLoading,
		leaderboardsFailed,
		retryLeaderboards,
		leaderboard,
	} = useHomeCommunityLobbyParams();

	// Only skeleton while this period's board is still missing — not after hydration.
	if (leaderboardsLoading && leaderboard == null) {
		return <CommunityRanksSkeleton />;
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-12">
			<HomeCommunityEmpty
				title={
					leaderboardsFailed
						? "Couldn't load rankings"
						: "No rankings this period"
				}
				description={
					leaderboardsFailed
						? "Check your connection and try again."
						: `No film or TV logs ${periodLabel === "all time" ? "yet" : `this ${periodLabel}`}.`
				}
				primaryHref={
					leaderboardsFailed ? undefined : "/home?browse=community&sort=lists"
				}
				primaryLabel={leaderboardsFailed ? undefined : "Browse lists"}
				secondaryHref={signedIn ? "/diary" : "/sign-in"}
				secondaryLabel={signedIn ? "Your diary" : "Sign in"}
			/>
			{leaderboardsFailed ? (
				<Button
					type="button"
					variant="secondary"
					className="mt-4"
					onClick={retryLeaderboards}
				>
					Try again
				</Button>
			) : null}
		</div>
	);
}

/**
 * Community browse body on `/home` — lists poster wall, review stack, or activity feed.
 */
export function HomeCommunityLobby({
	feed,
	period,
	rankKind,
	seed,
	leaderboard,
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	rankKind: HomeCommunityRankKind;
	seed: CommunityFeedSeed;
	leaderboard: LeaderboardPayload | null;
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}) {
	const periodLabel = leaderboardPeriodLabel(period).toLowerCase();

	if (isHomeLeaderboardFeed(feed)) {
		if (!leaderboard) {
			return (
				<HomeCommunityLobbyRanksFallback
					periodLabel={periodLabel}
					signedIn={signedIn}
				/>
			);
		}
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<HomeCommunityLeaderboard
					kind={rankKind}
					data={leaderboard}
					viewerUserId={viewerUserId}
				/>
			</div>
		);
	}

	if (feed === "lists") {
		if (seed.listSeeds.length === 0) {
			return (
				<HomeCommunityEmpty
					title={`No public lists ${period === "all" ? "yet" : `this ${periodLabel}`}`}
					description="When members publish lists in this window, they show up here — curated lanes, top tens, and shared canons."
					primaryHref={signedIn ? "/lists/new" : "/sign-up"}
					primaryLabel={signedIn ? "Create a list" : `Join ${APP_NAME}`}
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
				<HomeCuratorSpotlights patrons={seed.curatorSpotlights} />
				<CommunityListsInfinite
					seeds={seed.listSeeds}
					initialCursor={seed.initialListCursor}
					period={period}
					monochromePeersOnHover={monochromePeersOnHover}
				/>
			</div>
		);
	}

	if (feed === "reviews") {
		if (seed.reviews.length === 0) {
			return (
				<HomeCommunityEmpty
					title={`No published reviews ${period === "all" ? "yet" : `this ${periodLabel}`}`}
					description="Written reviews from the community land here once members publish from a film page in this window."
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
				<CommunityReviewsInfinite
					seeds={seed.reviews}
					initialCursor={seed.initialReviewCursor}
					period={period}
				/>
			</div>
		);
	}

	// Activity — following feed when signed in, otherwise platform discover highlights.
	if (seed.activityItems.length === 0) {
		return (
			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
				<HomeEditorialHighlights />
				<HomeCommunityEmpty
					title={
						signedIn
							? period === "all"
								? "Nothing from your circle yet"
								: `Nothing from your circle this ${periodLabel}`
							: "Sign in to see friend activity"
					}
					description={
						signedIn
							? "Follow people whose logs and lists you want here — the feed lights up when they post in this window."
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
			</div>
		);
	}

	return (
		<CommunityActivityInfinite
			seeds={seed.activityItems}
			initialCursor={seed.initialActivityCursor}
			period={period}
			signedIn={signedIn}
		/>
	);
}
