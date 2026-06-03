"use client";

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
	fetchHomeLeaderboardsByPeriodClient,
	homeLeaderboardMapsAreEmpty,
} from "@/lib/fetch-home-leaderboards-client";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

interface HomeCommunityLobbySnapshot {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
}

interface HomeCommunityLobbyParamsContextValue
	extends HomeCommunityLobbySnapshot {
	seed: CommunityFeedSeed;
	leaderboard: LeaderboardPayload | null;
	leaderboardsLoading: boolean;
	leaderboardsFailed: boolean;
	retryLeaderboards: () => void;
	selectFeed: (feed: HomeCommunityFeed) => void;
	selectPeriod: (period: HomeLeaderboardPeriod) => void;
}

const HomeCommunityLobbyParamsContext =
	createContext<HomeCommunityLobbyParamsContextValue | null>(null);

export function HomeCommunityLobbyParamsProvider({
	seed,
	feed,
	period,
	signedIn: _signedIn,
	children,
}: {
	seed: CommunityFeedSeed;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
	children: ReactNode;
}) {
	const { navigate } = useLobbyNavigation();

	const [pending, setPending] = useState<HomeCommunityLobbySnapshot | null>(
		null,
	);

	// Leaderboards are always client-fetched now — the RSC never ships them.
	const deferLeaderboards = true;

	const [filmLeaderboardsByPeriod, setFilmLeaderboardsByPeriod] = useState<
		Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>>
	>({});
	const [tvLeaderboardsByPeriod, setTvLeaderboardsByPeriod] = useState<
		Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>>
	>({});
	const [leaderboardsLoading, setLeaderboardsLoading] =
		useState(deferLeaderboards);
	const [leaderboardsFailed, setLeaderboardsFailed] = useState(false);
	const [leaderboardFetchGeneration, setLeaderboardFetchGeneration] =
		useState(0);

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

	// Committed state is the URL-resolved feed/period props from the RSC; `pending`
	// is the optimistic overlay so chip navigation feels instant.
	const committed = useMemo<HomeCommunityLobbySnapshot>(
		() => ({ feed, period }),
		[feed, period],
	);
	const active = pending ?? committed;

	useEffect(() => {
		if (pending && pending.feed === feed && pending.period === period) {
			setPending(null);
		}
	}, [pending, feed, period]);

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
		(nextFeed: HomeCommunityFeed) => {
			navigateLobby({ feed: nextFeed, period: active.period });
		},
		[active.period, navigateLobby],
	);

	const selectPeriod = useCallback(
		(nextPeriod: HomeLeaderboardPeriod) => {
			navigateLobby({ feed: active.feed, period: nextPeriod });
		},
		[active.feed, navigateLobby],
	);

	const value = useMemo(
		(): HomeCommunityLobbyParamsContextValue => ({
			feed: active.feed,
			period: active.period,
			seed,
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
			seed,
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
