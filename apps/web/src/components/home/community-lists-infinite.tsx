"use client";

import { cn } from "@still/ui/lib/utils";
import { useCallback } from "react";

import { CommunityInfiniteFooter } from "@/components/home/community-infinite-footer";
import { ListLobbyPoster } from "@/components/list/list-lobby-poster";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { readViewerTimeZone } from "@/lib/home-leaderboard-period";
import {
	HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
	HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME,
} from "@/lib/home-lobby-catalogue-layout";
import { toListBoardRow } from "@/lib/list-board-row";
import {
	type ListLobbySeed,
	listBoardRowToLobbySeed,
} from "@/lib/lists-lobby-order";
import {
	COMMUNITY_LISTS_LIMIT,
	fetchCommunityLists,
} from "@/lib/still-api-fetch";
import { useInfinitePager } from "@/lib/use-infinite-pager";

export function CommunityListsInfinite({
	seeds,
	initialCursor,
	period,
	monochromePeersOnHover,
}: {
	seeds: ListLobbySeed[];
	initialCursor: number | null;
	period: HomeLeaderboardPeriod;
	monochromePeersOnHover: boolean;
}) {
	const loadMore = useCallback(
		async (page: number, signal: AbortSignal) => {
			const raw = await fetchCommunityLists(period, readViewerTimeZone(), {
				page,
				signal,
			});
			if (raw == null) return { error: true as const };
			const items = raw.map((r) => listBoardRowToLobbySeed(toListBoardRow(r)));
			return {
				items,
				nextCursor: items.length >= COMMUNITY_LISTS_LIMIT ? page + 1 : null,
			};
		},
		[period],
	);

	const { items, footerState, sentinelRef, retry } = useInfinitePager<
		ListLobbySeed,
		number
	>({
		seeds,
		initialCursor,
		loadMore,
		getKey: (l) => l.id,
	});

	return (
		<>
			<div
				className={cn(
					HOME_LOBBY_CATALOGUE_GRID_CLASSNAME,
					monochromePeersOnHover &&
						HOME_LOBBY_CATALOGUE_POSTER_GRID_MONOCHROME_CLASSNAME,
				)}
			>
				{items.map((list, index) => (
					<ListLobbyPoster
						key={list.id}
						list={list}
						priority={index < 6}
						className={HOME_LOBBY_CATALOGUE_POSTER_LINK_CLASSNAME}
						frameClassName={HOME_LOBBY_CATALOGUE_POSTER_FRAME_CLASSNAME}
					/>
				))}
			</div>
			<CommunityInfiniteFooter
				footerState={footerState}
				sentinelRef={sentinelRef}
				retry={retry}
				loadingLabel="Loading more lists"
			/>
		</>
	);
}
