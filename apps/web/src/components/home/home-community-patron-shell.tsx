"use client";

import type { ReactNode } from "react";

import { CommunityFeedSkeleton } from "@/components/home/community-feed-skeleton";
import { HomeCommunityLobby } from "@/components/home/home-community-lobby";
import {
	HomeCommunityLobbyParamsProvider,
	useHomeCommunityLobbyParams,
} from "@/components/home/home-community-lobby-params-context";
import type { CommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type {
	HomeCommunityFeed,
	HomeCommunityRankKind,
} from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { MembersLeaderboardPayload } from "@/lib/members-leaderboard-types";

export function HomeCommunityPatronBody({
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: {
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}) {
	const {
		feed,
		committedFeed,
		period,
		committedPeriod,
		rankKind,
		committedRankKind,
		seed,
		leaderboard,
		membersLeaderboard,
	} = useHomeCommunityLobbyParams();

	const lobbyBodyStale =
		feed !== committedFeed ||
		period !== committedPeriod ||
		rankKind !== committedRankKind;

	if (lobbyBodyStale) {
		return <CommunityFeedSkeleton feed={feed} />;
	}

	return (
		<HomeCommunityLobby
			feed={committedFeed}
			period={committedPeriod}
			rankKind={committedRankKind}
			seed={seed}
			leaderboard={leaderboard}
			membersLeaderboard={membersLeaderboard}
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
	rankKind,
	membersLeaderboard,
	signedIn,
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
	return (
		<HomeCommunityLobbyParamsProvider
			seed={seed}
			feed={feed}
			period={period}
			rankKind={rankKind}
			membersLeaderboard={membersLeaderboard}
			signedIn={signedIn}
		>
			{children}
		</HomeCommunityLobbyParamsProvider>
	);
}
