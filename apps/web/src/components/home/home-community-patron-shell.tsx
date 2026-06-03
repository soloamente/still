"use client";

import type { ReactNode } from "react";

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
	const { feed, period, seed, leaderboard } = useHomeCommunityLobbyParams();
	return (
		<HomeCommunityLobby
			feed={feed}
			period={period}
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
