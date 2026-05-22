import {
	ProfileFilmographyPanel,
	type ProfileFilmographyRow,
} from "@/components/profile/profile-filmography-panel";
import { ProfileListsPanel } from "@/components/profile/profile-lists-panel";
import {
	type ProfileReviewRow,
	ProfileReviewsPanel,
} from "@/components/profile/profile-reviews-panel";
import type { ProfileTabId } from "@/components/profile/profile-tab-toolbar";
import type { HomeVenue } from "@/lib/home-venue";
import type { ListBoardRow } from "@/lib/list-board-row";
import { toListBoardRow } from "@/lib/list-board-row";
export function ProfileTabPanels({
	activeTab,
	movieRows,
	tvRows,
	moviesAllCount,
	tvAllCount,
	moviesVenueCount,
	tvVenueCount,
	favoritesOnly,
	showAllLedgerHref,
	lobbyVenue,
	switchVenueHref,
	reviews,
	lists,
	catalogueWaveKey,
	monochromePeersOnHover,
}: {
	activeTab: ProfileTabId;
	movieRows: ProfileFilmographyRow[];
	tvRows: ProfileFilmographyRow[];
	moviesAllCount: number;
	tvAllCount: number;
	moviesVenueCount: number;
	tvVenueCount: number;
	favoritesOnly: boolean;
	showAllLedgerHref: string;
	lobbyVenue: HomeVenue;
	switchVenueHref: string;
	reviews: ProfileReviewRow[];
	lists: ListBoardRow[];
	catalogueWaveKey: string;
	monochromePeersOnHover: boolean;
}) {
	if (activeTab === "movies") {
		return (
			<ProfileFilmographyPanel
				rows={movieRows}
				kind="movies"
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
				hasLogsOtherVenue={moviesAllCount > 0 && movieRows.length === 0}
				hasRowsWhenFavoritesOff={
					favoritesOnly && moviesVenueCount > 0 && movieRows.length === 0
				}
				favoritesOnly={favoritesOnly}
				showAllLedgerHref={showAllLedgerHref}
				switchVenueHref={switchVenueHref}
				lobbyVenue={lobbyVenue}
			/>
		);
	}

	if (activeTab === "tv") {
		return (
			<ProfileFilmographyPanel
				rows={tvRows}
				kind="tv"
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
				hasLogsOtherVenue={tvAllCount > 0 && tvRows.length === 0}
				hasRowsWhenFavoritesOff={
					favoritesOnly && tvVenueCount > 0 && tvRows.length === 0
				}
				favoritesOnly={favoritesOnly}
				showAllLedgerHref={showAllLedgerHref}
				switchVenueHref={switchVenueHref}
				lobbyVenue={lobbyVenue}
			/>
		);
	}

	if (activeTab === "reviews") {
		return <ProfileReviewsPanel rows={reviews} />;
	}

	if (activeTab === "lists") {
		return (
			<ProfileListsPanel
				lists={lists.map((l) => toListBoardRow(l))}
				catalogueWaveKey={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
			/>
		);
	}

	return null;
}
