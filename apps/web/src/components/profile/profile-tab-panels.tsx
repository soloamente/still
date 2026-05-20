import type { ReactNode } from "react";

import {
	ProfileFilmographyPanel,
	type ProfileFilmographyRow,
} from "@/components/profile/profile-filmography-panel";
import { ProfileListsPanel } from "@/components/profile/profile-lists-panel";
import { ProfileLobbyCatalogue } from "@/components/profile/profile-lobby-catalogue";
import {
	type ProfileReviewRow,
	ProfileReviewsPanel,
} from "@/components/profile/profile-reviews-panel";
import type { ProfileTabId } from "@/components/profile/profile-tab-toolbar";
import type { HomeVenue } from "@/lib/home-venue";
import type { ListBoardRow } from "@/lib/list-board-row";
import { toListBoardRow } from "@/lib/list-board-row";
import { favoriteToPersonFilmography } from "@/lib/profile-filmography-map";

type FavoriteRow = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
};

function SheetEmpty({ children }: { children: ReactNode }) {
	return (
		<div
			className="flex min-h-[min(36vh,18rem)] flex-1 flex-col items-center justify-center px-1 py-8 text-center sm:px-4"
			role="status"
		>
			<p className="max-w-sm text-balance text-muted-foreground text-sm leading-relaxed">
				{children}
			</p>
		</div>
	);
}

export function ProfileTabPanels({
	activeTab,
	movieRows,
	tvRows,
	moviesAllCount,
	tvAllCount,
	lobbyVenue,
	switchVenueHref,
	favorites,
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
	lobbyVenue: HomeVenue;
	switchVenueHref: string;
	favorites: FavoriteRow[];
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
				switchVenueHref={switchVenueHref}
				lobbyVenue={lobbyVenue}
			/>
		);
	}

	if (activeTab === "favorites") {
		const gridRows = favorites.map(favoriteToPersonFilmography);
		if (!gridRows.length) {
			return <SheetEmpty>No favorite titles pinned yet.</SheetEmpty>;
		}
		return (
			<ProfileLobbyCatalogue
				rows={gridRows}
				posterCellKeys={favorites.map((f) => `favorite-${f.tmdbId}`)}
				catalogueWaveKeyOverride={`favorites:${favorites.length}`}
				monochromePeersOnHover={monochromePeersOnHover}
			/>
		);
	}

	if (activeTab === "reviews") {
		return <ProfileReviewsPanel rows={reviews} />;
	}

	if (activeTab === "lists") {
		return <ProfileListsPanel lists={lists.map((l) => toListBoardRow(l))} />;
	}

	return null;
}
