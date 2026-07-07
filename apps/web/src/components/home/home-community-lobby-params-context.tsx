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
import { fetchHomeLeaderboardsByPeriodClient } from "@/lib/fetch-home-leaderboards-client";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type {
	HomeCommunityFeed,
	HomeCommunityRankKind,
} from "@/lib/home-community-feed";
import {
	isFilmTvRankKind,
	isHomeLeaderboardFeed,
} from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";
import type { MembersLeaderboardPayload } from "@/lib/members-leaderboard-types";

interface HomeCommunityLobbySnapshot {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	rankKind: HomeCommunityRankKind;
}

interface HomeCommunityLobbyParamsContextValue
	extends HomeCommunityLobbySnapshot {
	committedFeed: HomeCommunityFeed;
	committedPeriod: HomeLeaderboardPeriod;
	committedRankKind: HomeCommunityRankKind;
	seed: CommunityFeedSeed;
	leaderboard: LeaderboardPayload | null;
	membersLeaderboard: MembersLeaderboardPayload | null;
	leaderboardsLoading: boolean;
	leaderboardsFailed: boolean;
	retryLeaderboards: () => void;
	selectFeed: (feed: HomeCommunityFeed) => void;
	selectPeriod: (period: HomeLeaderboardPeriod) => void;
	selectRankKind: (rankKind: HomeCommunityRankKind) => void;
}

const HomeCommunityLobbyParamsContext =
	createContext<HomeCommunityLobbyParamsContextValue | null>(null);

export function HomeCommunityLobbyParamsProvider({
	seed,
	feed,
	period,
	rankKind,
	membersLeaderboard,
	signedIn: _signedIn,
	children,
}: {
	seed: CommunityFeedSeed;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	rankKind: HomeCommunityRankKind;
	membersLeaderboard: MembersLeaderboardPayload | null;
	signedIn: boolean;
	children: ReactNode;
}) {
	const { navigate } = useLobbyNavigation();

	const [pending, setPending] = useState<HomeCommunityLobbySnapshot | null>(
		null,
	);

	// Film/show diary boards are client-deferred — the RSC never ships them.
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
		// Clear cached maps so retry can actually refetch (maps were blocking the effect).
		setFilmLeaderboardsByPeriod({});
		setTvLeaderboardsByPeriod({});
		setLeaderboardFetchGeneration((n) => n + 1);
	}, []);

	useEffect(() => {
		if (!deferLeaderboards) return;
		// Only load rank boards when the patron is viewing Film/TV ranks — refetch on each visit.
		if (!isHomeLeaderboardFeed(feed)) return;
		void leaderboardFetchGeneration;

		const controller = new AbortController();
		void (async () => {
			try {
				setLeaderboardsLoading(true);
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
	}, [deferLeaderboards, leaderboardFetchGeneration, feed]);

	const committed = useMemo<HomeCommunityLobbySnapshot>(
		() => ({ feed, period, rankKind }),
		[feed, period, rankKind],
	);
	const active = pending ?? committed;

	useEffect(() => {
		if (
			pending &&
			pending.feed === feed &&
			pending.period === period &&
			pending.rankKind === rankKind
		) {
			setPending(null);
		}
	}, [pending, feed, period, rankKind]);

	const leaderboard = useMemo(() => {
		if (!isHomeLeaderboardFeed(active.feed)) return null;
		if (!isFilmTvRankKind(active.rankKind)) return null;
		if (active.rankKind === "tv") {
			return tvLeaderboardsByPeriod[active.period] ?? null;
		}
		return filmLeaderboardsByPeriod[active.period] ?? null;
	}, [
		active.feed,
		active.period,
		active.rankKind,
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
					rankKind: next.rankKind,
				}),
			);
		},
		[navigate],
	);

	const selectFeed = useCallback(
		(nextFeed: HomeCommunityFeed) => {
			navigateLobby({
				feed: nextFeed,
				period: active.period,
				rankKind: active.rankKind,
			});
		},
		[active.period, active.rankKind, navigateLobby],
	);

	const selectPeriod = useCallback(
		(nextPeriod: HomeLeaderboardPeriod) => {
			navigateLobby({
				feed: active.feed,
				period: nextPeriod,
				rankKind: active.rankKind,
			});
		},
		[active.feed, active.rankKind, navigateLobby],
	);

	const selectRankKind = useCallback(
		(nextRankKind: HomeCommunityRankKind) => {
			if (!isHomeLeaderboardFeed(active.feed)) return;
			navigateLobby({
				feed: active.feed,
				period: active.period,
				rankKind: nextRankKind,
			});
		},
		[active.feed, active.period, navigateLobby],
	);

	const value = useMemo(
		(): HomeCommunityLobbyParamsContextValue => ({
			feed: active.feed,
			period: active.period,
			rankKind: active.rankKind,
			committedFeed: feed,
			committedPeriod: period,
			committedRankKind: rankKind,
			seed,
			leaderboard,
			membersLeaderboard,
			leaderboardsLoading,
			leaderboardsFailed,
			retryLeaderboards,
			selectFeed,
			selectPeriod,
			selectRankKind,
		}),
		[
			active.feed,
			active.period,
			active.rankKind,
			feed,
			period,
			rankKind,
			seed,
			leaderboard,
			membersLeaderboard,
			leaderboardsLoading,
			leaderboardsFailed,
			retryLeaderboards,
			selectFeed,
			selectPeriod,
			selectRankKind,
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
