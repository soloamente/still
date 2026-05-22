export const HOME_LEADERBOARD_PERIODS = [
	{ id: "week", label: "Week" },
	{ id: "month", label: "Month" },
	{ id: "year", label: "Year" },
	{ id: "all", label: "All time" },
] as const;

export type HomeLeaderboardPeriod =
	(typeof HOME_LEADERBOARD_PERIODS)[number]["id"];

export const DEFAULT_HOME_LEADERBOARD_PERIOD: HomeLeaderboardPeriod = "month";

/** Parse `?period=` for any Community browse tab (lists, activity, ranks, …). */
export function parseHomeCommunityPeriod(
	raw: string | undefined | null,
): HomeLeaderboardPeriod {
	const s = raw?.trim().toLowerCase() ?? "";
	if (s === "week" || s === "month" || s === "year" || s === "all") return s;
	return DEFAULT_HOME_LEADERBOARD_PERIOD;
}

/** @deprecated Use {@link parseHomeCommunityPeriod}. */
export function parseHomeLeaderboardPeriod(
	raw: string | undefined | null,
): HomeLeaderboardPeriod {
	return parseHomeCommunityPeriod(raw);
}

export function leaderboardPeriodLabel(period: HomeLeaderboardPeriod): string {
	return (
		HOME_LEADERBOARD_PERIODS.find((p) => p.id === period)?.label ?? "Month"
	);
}

/** Browser IANA zone for API `tz` query — safe on server (returns UTC). */
export function readViewerTimeZone(): string {
	if (typeof Intl === "undefined") return "UTC";
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
	} catch {
		return "UTC";
	}
}
