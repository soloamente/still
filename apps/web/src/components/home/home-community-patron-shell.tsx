"use client";

import { type ReactNode, useMemo } from "react";

import { HomeCommunityLobby } from "@/components/home/home-community-lobby";
import {
	type HomeCommunityBundledData,
	HomeCommunityLobbyParamsProvider,
	useHomeCommunityLobbyParams,
} from "@/components/home/home-community-lobby-params-context";
import { LobbyNavigationProvider } from "@/components/lobby/lobby-navigation-provider";
import type { HomeFriendRailEntry } from "@/lib/home-friend-rail";
import { deriveFriendRailEntries } from "@/lib/home-friend-rail";

export interface HomeCommunityPatronShellProps
	extends HomeCommunityBundledData {
	monochromePeersOnHover: boolean;
	signedIn: boolean;
	viewerUserId: string | null;
}

export function HomeCommunityPatronBody({
	monochromePeersOnHover,
	signedIn,
	viewerUserId,
}: Omit<HomeCommunityPatronShellProps, keyof HomeCommunityBundledData>) {
	const { feed, period, listSeeds, reviews, activityItems, leaderboard } =
		useHomeCommunityLobbyParams();

	const friendRailEntries: HomeFriendRailEntry[] = useMemo(
		() => deriveFriendRailEntries(activityItems),
		[activityItems],
	);

	return (
		<HomeCommunityLobby
			feed={feed}
			period={period}
			listSeeds={listSeeds}
			reviews={reviews}
			activityItems={activityItems}
			friendRailEntries={friendRailEntries}
			monochromePeersOnHover={monochromePeersOnHover}
			signedIn={signedIn}
			leaderboard={leaderboard}
			viewerUserId={viewerUserId}
		/>
	);
}

/** Provider stack for community chrome + lobby (toolbar must render inside). */
export function HomeCommunityPatronProviders({
	bundled,
	children,
}: {
	bundled: HomeCommunityBundledData;
	children: ReactNode;
}) {
	return (
		<LobbyNavigationProvider>
			<HomeCommunityLobbyParamsProvider bundled={bundled}>
				{children}
			</HomeCommunityLobbyParamsProvider>
		</LobbyNavigationProvider>
	);
}
