"use client";

import { useSearchParams } from "next/navigation";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

import { useLobbyNavigation } from "@/components/lobby/lobby-navigation-provider";
import {
	filterActivityByCommunityPeriod,
	filterListSeedsByCommunityPeriod,
	filterReviewsByCommunityPeriod,
} from "@/lib/community-period-filter";
import type { HomeCommunityActivityItem } from "@/lib/home-community-activity";
import {
	type HomeCommunityFeed,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { parseHomeCommunityPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";

type CommunityReviewRow = {
	id: string;
	userId: string;
	movieId: number;
	title: string | null;
	body: string;
	rating: number | null;
	likesCount: number;
	commentsCount: number;
	publishedAt: string;
	listing?: {
		title: string;
		posterUrl: string | null;
		href: string;
		listingKind: "movie";
	};
};

interface HomeCommunityLobbySnapshot {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
}

interface HomeCommunityLobbyParamsContextValue
	extends HomeCommunityLobbySnapshot {
	listSeeds: ListLobbySeed[];
	reviews: CommunityReviewRow[];
	activityItems: HomeCommunityActivityItem[];
	leaderboard: LeaderboardPayload | null;
	selectFeed: (feed: HomeCommunityFeed) => void;
	selectPeriod: (period: HomeLeaderboardPeriod) => void;
}

const HomeCommunityLobbyParamsContext =
	createContext<HomeCommunityLobbyParamsContextValue | null>(null);

export interface HomeCommunityBundledData {
	listSeedsAll: ListLobbySeed[];
	reviewsAll: CommunityReviewRow[];
	activityItemsAll: HomeCommunityActivityItem[];
	filmLeaderboardsByPeriod: Partial<
		Record<HomeLeaderboardPeriod, LeaderboardPayload | null>
	>;
	tvLeaderboardsByPeriod: Partial<
		Record<HomeLeaderboardPeriod, LeaderboardPayload | null>
	>;
}

function snapshotFromSearchParams(
	searchParams: URLSearchParams,
): HomeCommunityLobbySnapshot {
	return {
		feed: parseHomeCommunityFeed(searchParams.get("sort")),
		period: parseHomeCommunityPeriod(searchParams.get("period")),
	};
}

export function HomeCommunityLobbyParamsProvider({
	bundled,
	children,
}: {
	bundled: HomeCommunityBundledData;
	children: ReactNode;
}) {
	const searchParams = useSearchParams();
	const { navigate } = useLobbyNavigation();

	const urlState = useMemo(
		() =>
			snapshotFromSearchParams(new URLSearchParams(searchParams.toString())),
		[searchParams],
	);

	const [pending, setPending] = useState<HomeCommunityLobbySnapshot | null>(
		null,
	);

	useEffect(() => {
		if (pending == null) return;
		if (pending.feed === urlState.feed && pending.period === urlState.period) {
			setPending(null);
		}
	}, [pending, urlState]);

	const active = pending ?? urlState;

	const listSeeds = useMemo(
		() => filterListSeedsByCommunityPeriod(bundled.listSeedsAll, active.period),
		[bundled.listSeedsAll, active.period],
	);
	const reviews = useMemo(
		() => filterReviewsByCommunityPeriod(bundled.reviewsAll, active.period),
		[bundled.reviewsAll, active.period],
	);
	const activityItems = useMemo(
		() =>
			filterActivityByCommunityPeriod(bundled.activityItemsAll, active.period),
		[bundled.activityItemsAll, active.period],
	);
	const leaderboard = useMemo(() => {
		if (active.feed === "film-ranks") {
			return bundled.filmLeaderboardsByPeriod[active.period] ?? null;
		}
		if (active.feed === "tv-ranks") {
			return bundled.tvLeaderboardsByPeriod[active.period] ?? null;
		}
		return null;
	}, [
		active.feed,
		active.period,
		bundled.filmLeaderboardsByPeriod,
		bundled.tvLeaderboardsByPeriod,
	]);

	const navigateLobby = useCallback(
		(next: HomeCommunityLobbySnapshot) => {
			setPending(next);
			navigate(
				buildHomeLobbyHref({
					browse: "community",
					sort: next.feed,
					period: next.period,
				}),
			);
		},
		[navigate],
	);

	const selectFeed = useCallback(
		(feed: HomeCommunityFeed) => {
			navigateLobby({ feed, period: active.period });
		},
		[active.period, navigateLobby],
	);

	const selectPeriod = useCallback(
		(period: HomeLeaderboardPeriod) => {
			navigateLobby({ feed: active.feed, period });
		},
		[active.feed, navigateLobby],
	);

	const value = useMemo(
		(): HomeCommunityLobbyParamsContextValue => ({
			feed: active.feed,
			period: active.period,
			listSeeds,
			reviews,
			activityItems,
			leaderboard,
			selectFeed,
			selectPeriod,
		}),
		[
			active.feed,
			active.period,
			listSeeds,
			reviews,
			activityItems,
			leaderboard,
			selectFeed,
			selectPeriod,
		],
	);

	return (
		<HomeCommunityLobbyParamsContext.Provider value={value}>
			{children}
		</HomeCommunityLobbyParamsContext.Provider>
	);
}

export function useHomeCommunityLobbyParams(): HomeCommunityLobbyParamsContextValue {
	const ctx = useContext(HomeCommunityLobbyParamsContext);
	if (ctx == null) {
		throw new Error(
			"useHomeCommunityLobbyParams must be used within HomeCommunityLobbyParamsProvider",
		);
	}
	return ctx;
}
