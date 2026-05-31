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
import type { CuratorSpotlightPatron } from "@/lib/creator-recognition";
import {
	fetchHomeLeaderboardsByPeriodClient,
	homeLeaderboardMapsAreEmpty,
} from "@/lib/fetch-home-leaderboards-client";
import {
	type HomeCommunityActivityItem,
	parseFeedApiActivityItems,
} from "@/lib/home-community-activity";
import type { HomeCommunityReviewRow } from "@/lib/home-community-core-fetch";
import {
	type HomeCommunityFeed,
	parseHomeCommunityFeed,
} from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import {
	parseHomeCommunityPeriod,
	readViewerTimeZone,
} from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { ListLobbySeed } from "@/lib/lists-lobby-order";
import { fetchCommunityActivity } from "@/lib/still-api-fetch";

interface HomeCommunityLobbySnapshot {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
}

interface HomeCommunityLobbyParamsContextValue
	extends HomeCommunityLobbySnapshot {
	listSeeds: ListLobbySeed[];
	reviews: HomeCommunityReviewRow[];
	activityItems: HomeCommunityActivityItem[];
	curatorSpotlights: CuratorSpotlightPatron[];
	leaderboard: LeaderboardPayload | null;
	leaderboardsLoading: boolean;
	leaderboardsFailed: boolean;
	retryLeaderboards: () => void;
	selectFeed: (feed: HomeCommunityFeed) => void;
	selectPeriod: (period: HomeLeaderboardPeriod) => void;
}

const HomeCommunityLobbyParamsContext =
	createContext<HomeCommunityLobbyParamsContextValue | null>(null);

export interface HomeCommunityBundledData {
	listSeedsAll: ListLobbySeed[];
	reviewsAll: HomeCommunityReviewRow[];
	activityItemsAll: HomeCommunityActivityItem[];
	curatorSpotlights: CuratorSpotlightPatron[];
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
	signedIn,
	children,
}: {
	bundled: HomeCommunityBundledData;
	/** Refetch `/api/feed` with the active period + viewer tz (divergence row). */
	signedIn: boolean;
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

	const deferLeaderboards = useMemo(
		() =>
			homeLeaderboardMapsAreEmpty(
				bundled.filmLeaderboardsByPeriod,
				bundled.tvLeaderboardsByPeriod,
			),
		[bundled.filmLeaderboardsByPeriod, bundled.tvLeaderboardsByPeriod],
	);

	const [filmLeaderboardsByPeriod, setFilmLeaderboardsByPeriod] = useState(
		bundled.filmLeaderboardsByPeriod,
	);
	const [tvLeaderboardsByPeriod, setTvLeaderboardsByPeriod] = useState(
		bundled.tvLeaderboardsByPeriod,
	);
	const [leaderboardsLoading, setLeaderboardsLoading] =
		useState(deferLeaderboards);
	const [leaderboardsFailed, setLeaderboardsFailed] = useState(false);
	const [leaderboardFetchGeneration, setLeaderboardFetchGeneration] =
		useState(0);
	const [activityItemsAll, setActivityItemsAll] = useState(
		bundled.activityItemsAll,
	);

	useEffect(() => {
		setActivityItemsAll(bundled.activityItemsAll);
	}, [bundled.activityItemsAll]);

	// Server Community RSC always ships empty leaderboard maps (client fill). Do not
	// re-sync those props on in-lobby tab changes — each RSC pass creates new `{}`
	// references and would wipe hydrated maps + set loading without re-running fetch.

	const retryLeaderboards = useCallback(() => {
		if (!deferLeaderboards) return;
		setLeaderboardsFailed(false);
		setLeaderboardsLoading(true);
		setLeaderboardFetchGeneration((n) => n + 1);
	}, [deferLeaderboards]);

	useEffect(() => {
		if (!deferLeaderboards) return;

		// Background fetch may have finished while patron was on Lists/Activity.
		if (
			!homeLeaderboardMapsAreEmpty(
				filmLeaderboardsByPeriod,
				tvLeaderboardsByPeriod,
			)
		) {
			setLeaderboardsLoading(false);
			return;
		}

		const controller = new AbortController();
		void (async () => {
			try {
				const [film, tv] = await Promise.all([
					fetchHomeLeaderboardsByPeriodClient("films", controller.signal),
					fetchHomeLeaderboardsByPeriodClient("tv", controller.signal),
				]);
				if (controller.signal.aborted) return;
				setFilmLeaderboardsByPeriod(film);
				setTvLeaderboardsByPeriod(tv);
				setLeaderboardsFailed(false);
			} catch {
				if (controller.signal.aborted) return;
				setLeaderboardsFailed(true);
			} finally {
				if (!controller.signal.aborted) {
					setLeaderboardsLoading(false);
				}
			}
		})();

		return () => controller.abort();
	}, [
		deferLeaderboards,
		leaderboardFetchGeneration,
		filmLeaderboardsByPeriod,
		tvLeaderboardsByPeriod,
	]);

	useEffect(() => {
		if (pending == null) return;
		if (pending.feed === urlState.feed && pending.period === urlState.period) {
			setPending(null);
		}
	}, [pending, urlState]);

	const active = pending ?? urlState;

	// Signed-in Activity uses patron tz + period — RSC only prefetches `period=all`.
	useEffect(() => {
		if (!signedIn) return;

		const controller = new AbortController();
		const tz = readViewerTimeZone();

		void (async () => {
			try {
				const payload = await fetchCommunityActivity(active.period, tz, true, {
					signal: controller.signal,
				});
				if (controller.signal.aborted || !payload) return;
				setActivityItemsAll(parseFeedApiActivityItems(payload));
			} catch {
				// Strict Mode / period chip changes abort in-flight fetches — ignore.
				if (controller.signal.aborted) return;
			}
		})();

		return () => controller.abort();
	}, [signedIn, active.period]);

	const listSeeds = useMemo(
		() => filterListSeedsByCommunityPeriod(bundled.listSeedsAll, active.period),
		[bundled.listSeedsAll, active.period],
	);
	const reviews = useMemo(
		() => filterReviewsByCommunityPeriod(bundled.reviewsAll, active.period),
		[bundled.reviewsAll, active.period],
	);
	const activityItems = useMemo(
		() => filterActivityByCommunityPeriod(activityItemsAll, active.period),
		[activityItemsAll, active.period],
	);
	const leaderboard = useMemo(() => {
		if (active.feed === "film-ranks") {
			return filmLeaderboardsByPeriod[active.period] ?? null;
		}
		if (active.feed === "tv-ranks") {
			return tvLeaderboardsByPeriod[active.period] ?? null;
		}
		return null;
	}, [
		active.feed,
		active.period,
		filmLeaderboardsByPeriod,
		tvLeaderboardsByPeriod,
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
			curatorSpotlights: bundled.curatorSpotlights,
			leaderboard,
			leaderboardsLoading,
			leaderboardsFailed,
			retryLeaderboards,
			selectFeed,
			selectPeriod,
		}),
		[
			active.feed,
			active.period,
			listSeeds,
			reviews,
			activityItems,
			bundled.curatorSpotlights,
			leaderboard,
			leaderboardsLoading,
			leaderboardsFailed,
			retryLeaderboards,
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
