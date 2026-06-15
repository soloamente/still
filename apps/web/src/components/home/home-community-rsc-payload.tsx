import type { ReactNode } from "react";

import { HomeCommunityPatronProviders } from "@/components/home/home-community-patron-shell";
import { authServer } from "@/lib/auth-server";
import { fetchMembersLeaderboardServer } from "@/lib/fetch-members-leaderboard-server";
import { fetchHomeCommunityFeedSeed } from "@/lib/home-community-core-fetch";
import type {
	HomeCommunityFeed,
	HomeCommunityRankKind,
} from "@/lib/home-community-feed";
import { isMembersRankKind } from "@/lib/home-community-feed";
import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import { serverApi } from "@/lib/server-api";

/**
 * Async RSC boundary for Community — seeds ONLY the active feed; leaderboards fill on the client.
 */
export async function HomeCommunityRscPayload({
	feed,
	period,
	rankKind,
	children,
}: {
	feed: HomeCommunityFeed;
	period: HomeLeaderboardPeriod;
	rankKind: HomeCommunityRankKind;
	children: ReactNode;
}) {
	const api = await serverApi();
	const session = await authServer();
	const [seed, membersLeaderboard] = await Promise.all([
		fetchHomeCommunityFeedSeed({ api, session, feed, period }),
		feed === "ranks" && isMembersRankKind(rankKind)
			? fetchMembersLeaderboardServer({
					sort: rankKind,
					period,
					tz: "UTC",
				})
			: Promise.resolve(null),
	]);

	return (
		<HomeCommunityPatronProviders
			seed={seed}
			feed={feed}
			period={period}
			rankKind={rankKind}
			membersLeaderboard={membersLeaderboard}
			signedIn={Boolean(session?.user)}
		>
			{children}
		</HomeCommunityPatronProviders>
	);
}
