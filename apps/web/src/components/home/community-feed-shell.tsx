"use client";

import { useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useId } from "react";
import { useHomeCommunityLobbyParams } from "@/components/home/home-community-lobby-params-context";
import {
	CommunityFeedIntro,
	CommunityFeedSection,
	HomeCommunityLobbyScroll,
} from "@/components/home/home-community-lobby-scroll";
import { HomeCuratorSpotlights } from "@/components/home/home-curator-spotlights";
import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import { SegmentedPillToolbar } from "@/components/ui/segmented-pill-toolbar";
import { formatCommunityActivityHeader } from "@/lib/community-activity-header";
import { COMMUNITY_FEED_STICKY_INTRO_CLASSNAME } from "@/lib/community-feed-row-layout";
import { formatCommunityReviewsHeader } from "@/lib/community-reviews-header";
import type { CuratorSpotlightPatron } from "@/lib/creator-recognition";
import {
	type HomeCommunityActivityScope,
	parseHomeCommunityActivityScope,
} from "@/lib/home-community-activity-scope";
import type { HomeCommunityReviewSort } from "@/lib/home-community-review-sort";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

const REVIEW_SORT_CHIPS: readonly {
	id: HomeCommunityReviewSort;
	label: string;
}[] = [
	{ id: "all", label: "Latest" },
	{ id: "most-liked", label: "Top rated" },
];

const ACTIVITY_SCOPE_CHIPS: readonly {
	id: HomeCommunityActivityScope;
	label: string;
}[] = [
	{ id: "following", label: "Following" },
	{ id: "discover", label: "Discover" },
];

function CommunitySortChipRail({
	"aria-label": ariaLabel,
	value,
	options,
	onChange,
	layoutId,
}: {
	"aria-label": string;
	value: string;
	options: readonly { id: string; label: string }[];
	onChange: (next: string) => void;
	layoutId: string;
}) {
	return (
		<SegmentedPillToolbar
			layoutId={layoutId}
			aria-label={ariaLabel}
			compact
			value={value}
			onChange={onChange}
			options={options}
		/>
	);
}

/** Reviews tab — sort chips + labelled feed section. */
export function CommunityReviewsFeedShell({
	period,
	reviewSort,
	children,
}: {
	period: HomeLeaderboardPeriod;
	reviewSort: HomeCommunityReviewSort;
	children: ReactNode;
}) {
	const headingId = useId();
	const { rankKind } = useHomeCommunityLobbyParams();
	const { navigate } = useLobbyNavigation();

	const selectReviewSort = useCallback(
		(next: HomeCommunityReviewSort) => {
			navigate(
				buildHomeLobbyHref({
					browse: "community",
					sort: "reviews",
					period,
					rankKind,
					reviewSort: next,
				}),
			);
		},
		[navigate, period, rankKind],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className={COMMUNITY_FEED_STICKY_INTRO_CLASSNAME}>
				<CommunityFeedIntro
					title={formatCommunityReviewsHeader({ sort: reviewSort, period })}
					headingId={headingId}
				>
					<CommunitySortChipRail
						aria-label="Review sort"
						layoutId="home-community-review-sort-pill"
						value={reviewSort}
						options={REVIEW_SORT_CHIPS}
						onChange={(next) =>
							selectReviewSort(next as HomeCommunityReviewSort)
						}
					/>
				</CommunityFeedIntro>
			</div>
			<HomeCommunityLobbyScroll contentKey={`reviews-${reviewSort}-${period}`}>
				<CommunityFeedSection labelledBy={headingId}>
					{children}
				</CommunityFeedSection>
			</HomeCommunityLobbyScroll>
		</div>
	);
}

/** Activity tab — scope chips + labelled feed section. */
export function CommunityActivityFeedShell({
	period,
	signedIn,
	isDiscoverScope,
	children,
}: {
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
	isDiscoverScope: boolean;
	children: ReactNode;
}) {
	const headingId = useId();
	const searchParams = useSearchParams();
	const { rankKind } = useHomeCommunityLobbyParams();
	const { navigate } = useLobbyNavigation();
	const activityScope = parseHomeCommunityActivityScope(
		searchParams.get("activityScope"),
	);

	const selectActivityScope = useCallback(
		(next: HomeCommunityActivityScope) => {
			navigate(
				buildHomeLobbyHref({
					browse: "community",
					sort: "activity",
					period,
					rankKind,
					activityScope: next,
				}),
			);
		},
		[navigate, period, rankKind],
	);

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className={COMMUNITY_FEED_STICKY_INTRO_CLASSNAME}>
				<CommunityFeedIntro
					title={formatCommunityActivityHeader({
						scope: isDiscoverScope ? "discover" : "following",
						period,
						signedIn,
					})}
					headingId={headingId}
				>
					{signedIn ? (
						<CommunitySortChipRail
							aria-label="Activity scope"
							layoutId="home-community-activity-scope-pill"
							value={activityScope}
							options={ACTIVITY_SCOPE_CHIPS}
							onChange={(next) =>
								selectActivityScope(next as HomeCommunityActivityScope)
							}
						/>
					) : null}
				</CommunityFeedIntro>
			</div>
			<HomeCommunityLobbyScroll
				contentKey={`activity-${activityScope}-${period}-${signedIn ? "in" : "out"}`}
			>
				<CommunityFeedSection labelledBy={headingId}>
					{children}
				</CommunityFeedSection>
			</HomeCommunityLobbyScroll>
		</div>
	);
}

/** Lists tab — sticky subsection header + curator row above the poster wall. */
export function CommunityListsFeedShell({
	total,
	curatorSpotlights,
	period,
	children,
}: {
	total: number;
	curatorSpotlights: CuratorSpotlightPatron[];
	period: HomeLeaderboardPeriod;
	children: ReactNode;
}) {
	const headingId = useId();

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className={COMMUNITY_FEED_STICKY_INTRO_CLASSNAME}>
				<CommunityFeedIntro
					title={
						total > 0
							? `${total.toLocaleString()} public ${total === 1 ? "list" : "lists"}`
							: "Public lists"
					}
					headingId={headingId}
				/>
			</div>
			<HomeCommunityLobbyScroll contentKey={`lists-${period}`}>
				<section aria-labelledby={headingId} className="min-w-0">
					{curatorSpotlights.length > 0 ? (
						<HomeCuratorSpotlights patrons={curatorSpotlights} />
					) : null}
					{children}
				</section>
			</HomeCommunityLobbyScroll>
		</div>
	);
}
