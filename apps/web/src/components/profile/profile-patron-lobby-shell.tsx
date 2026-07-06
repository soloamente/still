"use client";

import { cn } from "@still/ui/lib/utils";
import { useMemo } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { ProfileFollowsDrawerRoot } from "@/components/profile/profile-follows-drawer";
import { ProfileLobbyChrome } from "@/components/profile/profile-lobby-chrome";
import {
	ProfileLobbyParamsProvider,
	useProfileLobbyParams,
} from "@/components/profile/profile-lobby-params-context";
import { ProfilePatronHeader } from "@/components/profile/profile-patron-header";
import {
	type ProfileEarnedBadge,
	ProfilePatronMilestones,
	type ProfileUnlockedAchievement,
} from "@/components/profile/profile-patron-milestones";
import type { ProfileReviewRow } from "@/components/profile/profile-reviews-panel";
import { ProfileTabPanels } from "@/components/profile/profile-tab-panels";
import type { ProfileSocialTabId } from "@/components/profile/profile-tab-toolbar";
import { ProfileTopBar } from "@/components/profile/profile-top-bar";
import type { DiaryMetalTier } from "@/lib/diary-metal-tier";
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { HomeVenue } from "@/lib/home-venue";
import type { ListBoardRow } from "@/lib/list-board-row";
import type { ProfileBannerFrameId } from "@/lib/profile-appearance";
import { profileInitials } from "@/lib/profile-lobby-derive";
import { buildProfileLobbyHref } from "@/lib/profile-lobby-order";
import type { ProfileShowcaseTile } from "@/lib/profile-showcase";
import type { SavedQuoteLobbyItem } from "@/lib/quote-saved-types";
import type { TasteSignatureJson } from "@/lib/sense-taste-signature";

export interface ProfilePatronLobbyShellProps {
	handle: string;
	displayName: string;
	pronouns: string | null;
	bio: string | null;
	avatarUrl: string | null;
	stats: { followers: number; following: number };
	location: string | null;
	website: string | null;
	birthdayDisplay?: string | null;
	isMe: boolean;
	targetUserId: string;
	/** Signed-in viewer — powers Follow buttons inside the follows drawer. */
	viewerId: string | null;
	bannerUrl: string | null;
	bannerFrame?: ProfileBannerFrameId;
	accentColor: string | null;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	venueCounts: { movies: number; tv: number };
	filmographyCounts: {
		movies: number;
		tv: number;
		likedMovies: number;
		likedTv: number;
		reviews: number;
	};
	lists: ListBoardRow[];
	socialTabs: readonly ProfileSocialTabId[];
	earnedBadges: ProfileEarnedBadge[];
	unlockedAchievements: ProfileUnlockedAchievement[];
	monochromePeersOnHover: boolean;
	tasteSignature?: TasteSignatureJson | null;
	pinnedReviews?: ProfileReviewRow[];
	showcaseItems?: ProfileShowcaseTile[];
	savedQuotesPreview?: SavedQuoteLobbyItem[];
	pinnedQuoteSaveIds?: string[];
	canCompareTaste?: boolean;
	initialTasteCompareOpen?: boolean;
	curatorHeadline?: string | null;
	avatarIsAnimated?: boolean;
	bannerIsAnimated?: boolean;
	profilePortraitGrayscaleUntilHover?: boolean;
	diaryMetalTier?: DiaryMetalTier | null;
	activitySignatureEnabled?: boolean;
}

function ProfilePatronLobbyBody(props: ProfilePatronLobbyShellProps) {
	const {
		handle,
		displayName,
		pronouns,
		bio,
		avatarUrl,
		stats,
		location,
		website,
		birthdayDisplay,
		isMe,
		targetUserId,
		viewerId,
		bannerUrl,
		bannerFrame = "none",
		accentColor,
		seeds,
		totalPages,
		totalResults,
		venueCounts,
		filmographyCounts,
		lists,
		socialTabs,
		earnedBadges,
		unlockedAchievements,
		monochromePeersOnHover,
		tasteSignature,
		pinnedReviews = [],
		showcaseItems = [],
		savedQuotesPreview = [],
		pinnedQuoteSaveIds = [],
		canCompareTaste,
		initialTasteCompareOpen,
		curatorHeadline,
		avatarIsAnimated,
		bannerIsAnimated,
		profilePortraitGrayscaleUntilHover,
		diaryMetalTier = null,
		activitySignatureEnabled = true,
	} = props;

	const {
		order,
		venue,
		favoritesOnly,
		toolbarActiveTab,
		contentTab,
		ledgerTab,
	} = useProfileLobbyParams();

	const media: "movie" | "tv" = ledgerTab === "tv" ? "tv" : "movie";
	const orderToken: "latest" | "earliest" | "title" =
		order === "earliest_seen"
			? "earliest"
			: order === "title_az"
				? "title"
				: "latest";
	const query = useMemo(
		() => ({ media, order: orderToken, venue, favorites: favoritesOnly }),
		[media, orderToken, venue, favoritesOnly],
	);

	const moviesAllCount = filmographyCounts.movies;
	const tvAllCount = filmographyCounts.tv;
	const venueCountForMedia =
		media === "tv" ? venueCounts.tv : venueCounts.movies;

	const catalogueWaveKey =
		contentTab === "lists"
			? `lists:${lists.map((l) => l.id).join("|")}`
			: `${contentTab}:${order}:${venue}:${favoritesOnly ? "fav" : "all"}`;

	const sharePath =
		contentTab === "movies" || contentTab === "tv"
			? buildProfileLobbyHref({
					handle,
					tab: contentTab,
					order,
					venue,
					favoritesOnly,
				})
			: `/profile/${encodeURIComponent(handle)}?tab=${toolbarActiveTab}`;

	const switchVenue: HomeVenue =
		venue === "theaters" ? "streaming" : "theaters";
	const switchVenueHref = buildProfileLobbyHref({
		handle,
		tab: ledgerTab,
		order,
		venue: switchVenue,
		favoritesOnly,
	});
	const showAllLedgerHref = buildProfileLobbyHref({
		handle,
		tab: ledgerTab,
		order,
		venue,
		favoritesOnly: false,
	});

	return (
		<>
			<ProfileFollowsDrawerRoot viewerId={viewerId} />
			<ProfileTopBar displayName={displayName} sharePath={sharePath} />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"relative min-h-0 flex-1 overflow-hidden p-6 sm:gap-5 sm:p-8",
				)}
			>
				<div className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 sm:gap-5">
					<ProfilePatronHeader
						handle={handle}
						displayName={displayName}
						pronouns={pronouns}
						bio={bio}
						avatarUrl={avatarUrl}
						initials={profileInitials(displayName)}
						stats={stats}
						location={location}
						website={website}
						birthdayDisplay={birthdayDisplay}
						isMe={isMe}
						targetUserId={targetUserId}
						bannerUrl={bannerUrl}
						bannerFrame={bannerFrame}
						accentColor={accentColor}
						moviesCount={moviesAllCount}
						tvCount={tvAllCount}
						tasteSignature={tasteSignature}
						pinnedReviews={pinnedReviews}
						showcaseItems={showcaseItems}
						savedQuotesPreview={savedQuotesPreview}
						pinnedQuoteSaveIds={pinnedQuoteSaveIds}
						canCompareTaste={canCompareTaste}
						initialTasteCompareOpen={initialTasteCompareOpen}
						avatarIsAnimated={avatarIsAnimated}
						bannerIsAnimated={bannerIsAnimated}
						profilePortraitGrayscaleUntilHover={
							profilePortraitGrayscaleUntilHover
						}
						diaryMetalTier={diaryMetalTier}
						activitySignatureEnabled={activitySignatureEnabled}
					/>

					<ProfilePatronMilestones
						handle={handle}
						earnedBadges={earnedBadges}
						unlockedAchievements={unlockedAchievements}
						curatorHeadline={curatorHeadline}
					/>

					<ProfileLobbyChrome socialTabs={socialTabs} />

					<div className="min-h-0 flex-1">
						<ProfileTabPanels
							activeTab={contentTab}
							handle={handle}
							displayName={displayName}
							seeds={seeds}
							totalPages={totalPages}
							totalResults={totalResults}
							query={query}
							moviesAllCount={moviesAllCount}
							tvAllCount={tvAllCount}
							venueCountForMedia={venueCountForMedia}
							favoritesOnly={favoritesOnly}
							showAllLedgerHref={showAllLedgerHref}
							lobbyVenue={venue}
							switchVenueHref={switchVenueHref}
							lists={lists}
							catalogueWaveKey={catalogueWaveKey}
							monochromePeersOnHover={monochromePeersOnHover}
							isMe={isMe}
						/>
					</div>
				</div>
			</section>
		</>
	);
}

/**
 * Client profile lobby — filmography grid is server-paginated; tab/order/venue/favorites are URL-driven.
 */
export function ProfilePatronLobbyShell(props: ProfilePatronLobbyShellProps) {
	const { handle, socialTabs, filmographyCounts } = props;
	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<LobbyNavigationProvider>
				<ProfileLobbyParamsProvider
					handle={handle}
					socialTabs={socialTabs}
					counts={filmographyCounts}
				>
					<ProfilePatronLobbyBody {...props} />
				</ProfileLobbyParamsProvider>
			</LobbyNavigationProvider>
		</div>
	);
}
