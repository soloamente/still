import type { PopularMovieSeed } from "@/components/movie/popular-movies-infinite";
import { ProfileFilmographyPanel } from "@/components/profile/profile-filmography-panel";
import { ProfileListsPanel } from "@/components/profile/profile-lists-panel";
import {
	type ProfileReviewRow,
	ProfileReviewsPanel,
} from "@/components/profile/profile-reviews-panel";
import type { ProfileTabId } from "@/components/profile/profile-tab-toolbar";
import type { HomeVenue } from "@/lib/home-venue";
import type { ListBoardRow } from "@/lib/list-board-row";
import type { FilmographyQueryOpts } from "@/lib/profile-filmography-fetch";

export function ProfileTabPanels({
	activeTab,
	handle,
	displayName,
	seeds,
	totalPages,
	totalResults,
	query,
	moviesAllCount,
	tvAllCount,
	venueCountForMedia,
	favoritesOnly,
	showAllLedgerHref,
	lobbyVenue,
	switchVenueHref,
	reviews,
	lists,
	catalogueWaveKey,
	monochromePeersOnHover,
	isMe = false,
}: {
	activeTab: ProfileTabId;
	handle: string;
	displayName: string;
	seeds: PopularMovieSeed[];
	totalPages: number;
	totalResults: number;
	query: Omit<FilmographyQueryOpts, "signal">;
	moviesAllCount: number;
	tvAllCount: number;
	venueCountForMedia: number;
	favoritesOnly: boolean;
	showAllLedgerHref: string;
	lobbyVenue: HomeVenue;
	switchVenueHref: string;
	reviews: ProfileReviewRow[];
	lists: ListBoardRow[];
	catalogueWaveKey: string;
	monochromePeersOnHover: boolean;
	isMe?: boolean;
}) {
	if (activeTab === "movies" || activeTab === "tv") {
		const kind = activeTab;
		const allCount = kind === "tv" ? tvAllCount : moviesAllCount;
		return (
			<ProfileFilmographyPanel
				handle={handle}
				displayName={displayName}
				seeds={seeds}
				totalPages={totalPages}
				totalResults={totalResults}
				query={query}
				kind={kind}
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
				hasLogsOtherVenue={allCount > 0 && totalResults === 0}
				hasRowsWhenFavoritesOff={
					favoritesOnly && venueCountForMedia > 0 && totalResults === 0
				}
				favoritesOnly={favoritesOnly}
				showAllLedgerHref={showAllLedgerHref}
				switchVenueHref={switchVenueHref}
				lobbyVenue={lobbyVenue}
				isOwnProfile={isMe}
			/>
		);
	}
	if (activeTab === "reviews") {
		return <ProfileReviewsPanel rows={reviews} isMe={isMe} />;
	}
	if (activeTab === "lists") {
		return (
			<ProfileListsPanel
				lists={lists}
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
			/>
		);
	}
	return null;
}
