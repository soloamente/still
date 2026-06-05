"use client";

import { ListMusic } from "lucide-react";
import { useMemo } from "react";

import { ListsLobbyCatalogue } from "@/components/list/lists-lobby-catalogue";
import { ProfileSocialEmpty } from "@/components/profile/profile-social-empty";
import type { ListBoardRow } from "@/lib/list-board-row";
import {
	listBoardRowToLobbySeed,
	sortListsLobbyRows,
} from "@/lib/lists-lobby-order";

/**
 * Patron lists tab — same poster wall as `/lists` and community **Lists** (`ListsLobbyCatalogue`).
 */
export function ProfileListsPanel({
	lists,
	catalogueWaveKey,
	monochromePeersOnHover = false,
}: {
	lists: ListBoardRow[];
	catalogueWaveKey: string;
	monochromePeersOnHover?: boolean;
}) {
	const seeds = useMemo(
		() =>
			sortListsLobbyRows(lists, "recently_updated").map(
				listBoardRowToLobbySeed,
			),
		[lists],
	);

	if (!seeds.length) {
		return (
			<ProfileSocialEmpty
				icon={ListMusic}
				title="No public lists yet"
				body="Curated rails and watchlists appear here once they are shared on the profile."
			/>
		);
	}

	return (
		<div className="min-h-0 flex-1 overflow-y-auto overflow-x-visible px-0.5 pb-2">
			<ListsLobbyCatalogue
				seeds={seeds}
				catalogueWaveKeyOverride={catalogueWaveKey}
				monochromePeersOnHover={monochromePeersOnHover}
			/>
		</div>
	);
}
