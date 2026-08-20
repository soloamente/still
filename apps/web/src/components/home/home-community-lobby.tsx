"use client";

import { Button } from "@still/ui/components/button";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { CommunityActivityInfinite } from "@/components/home/community-activity-infinite";
import {
	CommunityActivityFeedShell,
	CommunityListsFeedShell,
	CommunityReviewsFeedShell,
} from "@/components/home/community-feed-shell";
import { CommunityListsInfinite } from "@/components/home/community-lists-infinite";
import { CommunityRanksSkeleton } from "@/components/home/community-ranks-skeleton";
import { CommunityReviewsInfinite } from "@/components/home/community-reviews-infinite";
import { HomeCommunityEmpty } from "@/components/home/home-community-empty";
import { HomeCommunityLeaderboard } from "@/components/home/home-community-leaderboard";
import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import { HomeCommunityLobbyScroll } from "@/components/home/home-community-lobby-scroll";
import { MembersLeaderboard } from "@/components/members/members-leaderboard";
import { APP_NAME } from "@/lib/app-brand";
import { parseHomeCommunityActivityScope } from "@/lib/home-community-activity-scope";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import {
	type HomeCommunityFeed,
	type HomeCommunityRankKind,
	isFilmTvRankKind,
	isHomeLeaderboardFeed,
	isMembersRankKind,
} from "@/lib/home-community-feed";
import { HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME } from "@/lib/home-community-lobby-layout";
import { parseHomeCommunityReviewSort } from "@/lib/home-community-review-sort";
import {
	type HomeLeaderboardPeriod,
	leaderboardPeriodLabel,
} from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { MembersLeaderboardPayload } from "@/lib/members-leaderboard-types";

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

	if (leaderboardsLoading && leaderboard == null) {
		return (
			<HomeCommunityLobbyScroll contentKey="ranks-loading">
				<CommunityRanksSkeleton />
			</HomeCommunityLobbyScroll>
		);
	}

	return (
		<HomeCommunityLobbyScroll contentKey="ranks-empty">
			<div className={HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME}>
				<HomeCommunityEmpty
					title={
						leaderboardsFailed
							? "Unable to load rankings"
							: "No rankings this period"
					}
					description={
						leaderboardsFailed
							? "Check your connection and try again."
							: `No film or TV diary logs ${periodLabel === "all time" ? "yet" : `this ${periodLabel}`}.`
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
		</HomeCommunityLobbyScroll>
	);
}

function HomeCommunityLobbyEmpty({ children }: { children: ReactNode }) {
	return (
		<HomeCommunityLobbyScroll>
			<div className={HOME_COMMUNITY_LOBBY_EMPTY_CENTER_CLASSNAME}>
				{children}
			</div>
		</HomeCommunityLobbyScroll>
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
	membersLeaderboard,
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	rankKind: HomeCommunityRankKind;
	seed: CommunityFeedSeed;
	leaderboard: LeaderboardPayload | null;
	membersLeaderboard: MembersLeaderboardPayload | null;
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}) {
	const periodLabel = leaderboardPeriodLabel(period).toLowerCase();
	const searchParams = useSearchParams();
	const reviewSort = parseHomeCommunityReviewSort(
		searchParams.get("reviewSort"),
	);
	const mostLikedReviews = reviewSort === "most-liked";

	if (isHomeLeaderboardFeed(feed)) {
		if (isMembersRankKind(rankKind)) {
			return (
				<HomeCommunityLobbyScroll contentKey={`members-${rankKind}-${period}`}>
					<MembersLeaderboard
						initialData={membersLeaderboard}
						memberSort={rankKind}
						period={period}
						viewerUserId={viewerUserId}
					/>
				</HomeCommunityLobbyScroll>
			);
		}

		if (!leaderboard || !isFilmTvRankKind(rankKind)) {
			return (
				<HomeCommunityLobbyRanksFallback
					periodLabel={periodLabel}
					signedIn={signedIn}
				/>
			);
		}
		return (
			<HomeCommunityLobbyScroll contentKey={`ranks-${rankKind}-${period}`}>
				<HomeCommunityLeaderboard
					kind={rankKind}
					data={leaderboard}
					viewerUserId={viewerUserId}
				/>
			</HomeCommunityLobbyScroll>
		);
	}

	if (feed === "lists") {
		if (seed.listSeeds.length === 0) {
			return (
				<HomeCommunityLobbyEmpty>
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
				</HomeCommunityLobbyEmpty>
			);
		}
		return (
			<CommunityListsFeedShell
				total={seed.listTotalCount}
				curatorSpotlights={seed.curatorSpotlights}
				period={period}
			>
				<CommunityListsInfinite
					seeds={seed.listSeeds}
					initialCursor={seed.initialListCursor}
					period={period}
					monochromePeersOnHover={monochromePeersOnHover}
				/>
			</CommunityListsFeedShell>
		);
	}

	if (feed === "reviews") {
		const reviewRows = mostLikedReviews ? seed.topRatedReviews : seed.reviews;
		const reviewsEmpty = reviewRows.length === 0;
		if (reviewsEmpty) {
			return (
				<HomeCommunityLobbyEmpty>
					<HomeCommunityEmpty
						title={
							mostLikedReviews
								? `No top rated reviews ${period === "all" ? "yet" : `this ${periodLabel}`}`
								: `No published reviews ${period === "all" ? "yet" : `this ${periodLabel}`}`
						}
						description={
							mostLikedReviews
								? "Reviews with the most likes and replies in this window rise to the top."
								: "New reviews from the community appear here once members publish from a title page."
						}
						primaryHref={buildHomeLobbyHref({
							browse: "movies",
							sort: "popular",
						})}
						primaryLabel="Browse movies"
						secondaryHref="/diary"
						secondaryLabel="Your diary"
					/>
				</HomeCommunityLobbyEmpty>
			);
		}
		return (
			<CommunityReviewsFeedShell period={period} reviewSort={reviewSort}>
				<CommunityReviewsInfinite
					seeds={reviewRows}
					initialCursor={
						mostLikedReviews
							? seed.initialTopRatedCursor
							: seed.initialReviewCursor
					}
					period={period}
					reviewSort={reviewSort}
				/>
			</CommunityReviewsFeedShell>
		);
	}

	if (feed === "activity") {
		const activityScope = parseHomeCommunityActivityScope(
			searchParams.get("activityScope"),
		);
		const isDiscoverScope = !signedIn || activityScope === "discover";
		const activityRows = isDiscoverScope
			? seed.discoverActivityItems
			: seed.activityItems;
		const hasDiscoverFallback =
			signedIn && !isDiscoverScope && seed.discoverActivityItems.length > 0;

		if (activityRows.length === 0) {
			return (
				<HomeCommunityLobbyEmpty>
					<HomeCommunityEmpty
						title={
							!signedIn
								? "Sign in for your following feed"
								: isDiscoverScope
									? period === "all"
										? "No public activity yet"
										: `No public activity this ${periodLabel}`
									: period === "all"
										? "No activity from people you follow"
										: `No activity from people you follow this ${periodLabel}`
						}
						description={
							!signedIn
								? "Logs, reviews, and lists from people you follow show up here. Browse public highlights on Discover without signing in."
								: isDiscoverScope
									? "Public logs, reviews, and lists from the community appear here for this window."
									: "Follow members whose taste you trust — their logs and lists will show up here when they post."
						}
						primaryHref={
							!signedIn
								? "/sign-in"
								: buildHomeLobbyHref({
										browse: "community",
										sort: "ranks",
										rankKind: "reviews",
									})
						}
						primaryLabel={!signedIn ? "Sign in" : "Discover members"}
						secondaryHref={
							hasDiscoverFallback
								? buildHomeLobbyHref({
										browse: "community",
										sort: "activity",
										period,
										activityScope: "discover",
									})
								: buildHomeLobbyHref({
										browse: "movies",
										sort: "popular",
									})
						}
						secondaryLabel={
							hasDiscoverFallback ? "Browse public activity" : "Browse movies"
						}
					/>
				</HomeCommunityLobbyEmpty>
			);
		}

		return (
			<CommunityActivityFeedShell
				period={period}
				signedIn={signedIn}
				isDiscoverScope={isDiscoverScope}
			>
				<CommunityActivityInfinite
					seeds={activityRows}
					initialCursor={seed.initialActivityCursor}
					period={period}
					paginate={!isDiscoverScope && signedIn}
				/>
			</CommunityActivityFeedShell>
		);
	}

	return null;
}
