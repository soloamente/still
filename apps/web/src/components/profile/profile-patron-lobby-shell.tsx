"use client";

import { cn } from "@still/ui/lib/utils";
import { useMemo } from "react";

import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import type { ProfileFilmographyRow } from "@/components/profile/profile-filmography-panel";
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
import { HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME } from "@/lib/home-lobby-catalogue-layout";
import type { HomeVenue } from "@/lib/home-venue";
import type { ListBoardRow } from "@/lib/list-board-row";
import type { ProfileBannerFrameId } from "@/lib/profile-appearance";
import {
	filmographyFromRecentlyWatched,
	prepareProfileFilmography,
	profileInitials,
	splitProfileFilmographyLedger,
	titleCountLineForProfileTab,
} from "@/lib/profile-lobby-derive";
import {
	buildProfileLobbyHref,
	profileLogMatchesProfileLobbyVenue,
} from "@/lib/profile-lobby-order";
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
	isMe: boolean;
	targetUserId: string;
	bannerUrl: string | null;
	bannerFrame?: ProfileBannerFrameId;
	accentColor: string | null;
	recentlyWatched: ProfileFilmographyRow[];
	recentReviews: ProfileReviewRow[];
	lists: ListBoardRow[];
	socialTabs: readonly ProfileSocialTabId[];
	earnedBadges: ProfileEarnedBadge[];
	unlockedAchievements: ProfileUnlockedAchievement[];
	monochromePeersOnHover: boolean;
	tasteSignature?: TasteSignatureJson | null;
	pinnedReviews?: ProfileReviewRow[];
	canCompareTaste?: boolean;
	initialTasteCompareOpen?: boolean;
	isCurator?: boolean;
	curatorHeadline?: string | null;
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
		isMe,
		targetUserId,
		bannerUrl,
		bannerFrame = "none",
		accentColor,
		recentlyWatched,
		recentReviews,
		lists,
		socialTabs,
		earnedBadges,
		unlockedAchievements,
		monochromePeersOnHover,
		tasteSignature,
		pinnedReviews = [],
		canCompareTaste,
		initialTasteCompareOpen,
		isCurator,
		curatorHeadline,
	} = props;

	const {
		order,
		venue,
		favoritesOnly,
		toolbarActiveTab,
		contentTab,
		ledgerTab,
	} = useProfileLobbyParams();

	const allFilmographyRows = useMemo(
		() => prepareProfileFilmography(recentlyWatched, order),
		[recentlyWatched, order],
	);
	const { movieRows: moviesAll, tvRows: tvAll } = useMemo(
		() => splitProfileFilmographyLedger(allFilmographyRows),
		[allFilmographyRows],
	);

	const venueFilteredRows = useMemo(
		() =>
			allFilmographyRows.filter((row) =>
				profileLogMatchesProfileLobbyVenue(row, venue),
			),
		[allFilmographyRows, venue],
	);

	const filmographyRows = useMemo(
		() =>
			favoritesOnly
				? venueFilteredRows.filter((row) => row.log.liked)
				: venueFilteredRows,
		[favoritesOnly, venueFilteredRows],
	);

	const { movieRows, tvRows } = useMemo(
		() => splitProfileFilmographyLedger(filmographyRows),
		[filmographyRows],
	);
	const { movieRows: moviesVenueAll, tvRows: tvVenueAll } = useMemo(
		() => splitProfileFilmographyLedger(venueFilteredRows),
		[venueFilteredRows],
	);

	const ledgerPosterKeys =
		contentTab === "movies"
			? movieRows.map((r) => r.log.id)
			: contentTab === "tv"
				? tvRows.map((r) => r.log.id)
				: [];
	const catalogueWaveKey =
		contentTab === "lists"
			? `lists:${lists.map((l) => l.id).join("|")}`
			: `${contentTab}:${order}:${ledgerPosterKeys.join("|")}`;

	const titleCountLine = titleCountLineForProfileTab(
		toolbarActiveTab,
		movieRows.length,
		tvRows.length,
		favoritesOnly,
		recentReviews.length,
		lists.length,
	);

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
			<ProfileTopBar displayName={displayName} sharePath={sharePath} />
			<section
				className={cn(
					HOME_LOBBY_CATALOGUE_SECTION_BASE_CLASSNAME,
					"min-h-0 flex-1 gap-4 overflow-visible p-6 sm:gap-5 sm:p-8",
				)}
			>
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
					isMe={isMe}
					targetUserId={targetUserId}
					bannerUrl={bannerUrl}
					bannerFrame={bannerFrame}
					accentColor={accentColor}
					titleCountLine={titleCountLine}
					tasteSignature={tasteSignature}
					pinnedReviews={pinnedReviews}
					canCompareTaste={canCompareTaste}
					initialTasteCompareOpen={initialTasteCompareOpen}
					isCurator={isCurator}
					curatorHeadline={curatorHeadline}
				/>

				<ProfilePatronMilestones
					handle={handle}
					earnedBadges={earnedBadges}
					unlockedAchievements={unlockedAchievements}
				/>

				<ProfileLobbyChrome socialTabs={socialTabs} />

				<div className="min-h-0 flex-1">
					<ProfileTabPanels
						activeTab={contentTab}
						movieRows={movieRows}
						tvRows={tvRows}
						moviesAllCount={moviesAll.length}
						tvAllCount={tvAll.length}
						moviesVenueCount={moviesVenueAll.length}
						tvVenueCount={tvVenueAll.length}
						favoritesOnly={favoritesOnly}
						showAllLedgerHref={showAllLedgerHref}
						lobbyVenue={venue}
						switchVenueHref={switchVenueHref}
						reviews={recentReviews}
						lists={lists}
						catalogueWaveKey={catalogueWaveKey}
						monochromePeersOnHover={monochromePeersOnHover}
					/>
				</div>
			</section>
		</>
	);
}

/**
 * Client profile lobby — ledger filters run locally for instant chips.
 */
export function ProfilePatronLobbyShell(props: ProfilePatronLobbyShellProps) {
	const { handle, recentlyWatched, socialTabs } = props;
	const { movieRows: moviesAll, tvRows: tvAll } = useMemo(() => {
		const rows = filmographyFromRecentlyWatched(recentlyWatched);
		return splitProfileFilmographyLedger(rows);
	}, [recentlyWatched]);

	return (
		<div className="flex flex-1 flex-col overflow-visible bg-background">
			<LobbyNavigationProvider>
				<ProfileLobbyParamsProvider
					handle={handle}
					socialTabs={socialTabs}
					moviesAll={moviesAll}
					tvAll={tvAll}
				>
					<ProfilePatronLobbyBody {...props} />
				</ProfileLobbyParamsProvider>
			</LobbyNavigationProvider>
		</div>
	);
}
