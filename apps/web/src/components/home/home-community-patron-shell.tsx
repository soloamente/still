"use client";

import { type ReactNode, useMemo } from "react";

import { HomeCommunityLobby } from "@/components/home/home-community-lobby";
import {
	type HomeCommunityBundledData,
	HomeCommunityLobbyParamsProvider,
	useHomeCommunityLobbyParams,
} from "@/components/home/home-community-lobby-params-context";
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
	const {
		feed,
		period,
		listSeeds,
		reviews,
		activityItems,
		leaderboard,
		curatorSpotlights,
	} = useHomeCommunityLobbyParams();

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
			curatorSpotlights={curatorSpotlights}
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
	signedIn,
	children,
}: {
	bundled: HomeCommunityBundledData;
	signedIn: boolean;
	children: ReactNode;
}) {
	return (
		<HomeCommunityLobbyParamsProvider bundled={bundled} signedIn={signedIn}>
			{children}
		</HomeCommunityLobbyParamsProvider>
	);
}
