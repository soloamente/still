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

/** Ledger poster subline — e.g. "2nd this month", "1st this week". */
export function leaderboardPeriodWatchOrdinalLabel(
	index: number,
	period: HomeLeaderboardPeriod,
): string {
	const ordinal =
		index === 1
			? "1st"
			: index === 2
				? "2nd"
				: index === 3
					? "3rd"
					: `${index}th`;

	switch (period) {
		case "week":
			return `${ordinal} this week`;
		case "month":
			return `${ordinal} this month`;
		case "year":
			return `${ordinal} this year`;
		case "all":
			return `${ordinal} all time`;
		default: {
			const _exhaustive: never = period;
			return _exhaustive;
		}
	}
}

function leaderboardWatchedPeriodPhrase(period: HomeLeaderboardPeriod): string {
	switch (period) {
		case "week":
			return "this week";
		case "month":
			return "this month";
		case "year":
			return "this year";
		case "all":
			return "all time";
		default: {
			const _exhaustive: never = period;
			return _exhaustive;
		}
	}
}

/** Ledger drawer header — e.g. "13 films watched this month". */
export function leaderboardWatchLedgerSummaryLabel(
	count: number,
	kind: "films" | "tv",
	period: HomeLeaderboardPeriod,
): string {
	const media =
		kind === "tv"
			? count === 1
				? "show"
				: "shows"
			: count === 1
				? "film"
				: "films";
	return `${count} ${media} watched ${leaderboardWatchedPeriodPhrase(period)}`;
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
