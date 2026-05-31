import type { ReactNode } from "react";

import { HomeCommunityPatronProviders } from "@/components/home/home-community-patron-shell";
import { authServer } from "@/lib/auth-server";
import { fetchHomeCommunityCore } from "@/lib/home-community-core-fetch";
import { serverApi } from "@/lib/server-api";

/**
 * Async RSC boundary for Community — core feeds only; leaderboards fill on the client.
 */
export async function HomeCommunityRscPayload({
	children,
}: {
	children: ReactNode;
}) {
	const api = await serverApi();
	const session = await authServer();
	const core = await fetchHomeCommunityCore({ api, session });

	return (
		<HomeCommunityPatronProviders
			bundled={{
				...core,
				curatorSpotlights: core.curatorSpotlights,
				filmLeaderboardsByPeriod: {},
				tvLeaderboardsByPeriod: {},
			}}
			signedIn={Boolean(session?.user)}
		>
			{children}
		</HomeCommunityPatronProviders>
	);
}
