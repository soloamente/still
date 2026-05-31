import type { HomeLeaderboardPeriod } from "@/lib/home-leaderboard-period";
import type { LeaderboardPayload } from "@/lib/home-leaderboard-types";
import { fetchCommunityLeaderboard } from "@/lib/still-api-fetch";

const HOME_LEADERBOARD_PERIODS: HomeLeaderboardPeriod[] = [
	"week",
	"month",
	"year",
	"all",
];

/** Client fill for rank tabs — all periods prefetched so chips stay instant. */
export async function fetchHomeLeaderboardsByPeriodClient(
	kind: "films" | "tv",
	signal?: AbortSignal,
): Promise<Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>>> {
	const out: Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>> =
		{};

	await Promise.all(
		HOME_LEADERBOARD_PERIODS.map(async (period) => {
			out[period] = await fetchCommunityLeaderboard(kind, period, "UTC", {
				signal,
			});
		}),
	);

	return out;
}

export function homeLeaderboardMapsAreEmpty(
	film: Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>>,
	tv: Partial<Record<HomeLeaderboardPeriod, LeaderboardPayload | null>>,
): boolean {
	return Object.keys(film).length === 0 && Object.keys(tv).length === 0;
}
