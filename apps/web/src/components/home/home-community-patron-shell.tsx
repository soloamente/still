"use client";

import type { ReactNode } from "react";

import { CommunityFeedSkeleton } from "@/components/home/community-feed-skeleton";
import { HomeCommunityLobby } from "@/components/home/home-community-lobby";
import {
	HomeCommunityLobbyParamsProvider,
	useHomeCommunityLobbyParams,
} from "@/components/home/home-community-lobby-params-context";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type { HomeCommunityFeed } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";

export function HomeCommunityPatronBody({
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: {
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}) {
	const { feed, committedFeed, period, committedPeriod, seed, leaderboard } =
		useHomeCommunityLobbyParams();

	// Optimistic chip taps use `useTransition` — RSC keeps the previous tab's body
	// until the new payload lands; show a feed-shaped skeleton instead of stale empty states.
	const lobbyBodyStale = feed !== committedFeed || period !== committedPeriod;

	if (lobbyBodyStale) {
		return <CommunityFeedSkeleton feed={feed} />;
	}

	return (
		<HomeCommunityLobby
			feed={committedFeed}
			period={committedPeriod}
			seed={seed}
			leaderboard={leaderboard}
			monochromePeersOnHover={monochromePeersOnHover}
			signedIn={signedIn}
			viewerUserId={viewerUserId}
		/>
	);
}

export function HomeCommunityPatronProviders({
	seed,
	feed,
	period,
	signedIn,
	children,
}: {
	seed: CommunityFeedSeed;
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	signedIn: boolean;
	children: ReactNode;
}) {
	return (
		<HomeCommunityLobbyParamsProvider
			seed={seed}
			feed={feed}
			period={period}
			signedIn={signedIn}
		>
			{children}
		</HomeCommunityLobbyParamsProvider>
	);
}
