import { redirect } from "next/navigation";

import { parseHomeCommunityRankKind } from "@/lib/home-community-feed";
import { parseHomeCommunityPeriod } from "@/lib/home-leaderboard-period";
import { buildHomeLobbyHref } from "@/lib/home-lobby-url";

/** Legacy `/members` URLs → Community **Ranks** with the matching `?rank=` slice. */
export default async function MembersRedirectPage({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string; period?: string }>;
}) {
	const sp = await searchParams;
	// Standalone page used `?sort=` for the contribution dimension — map to `?rank=`.
	const rankKind = parseHomeCommunityRankKind(null, "members", sp.sort);
	const period = parseHomeCommunityPeriod(sp.period);

	redirect(
		buildHomeLobbyHref({
			browse: "community",
			sort: "ranks",
			rankKind,
			period,
		}),
	);
}
