import { type AnyColumn, and, gte, lt, type SQL } from "drizzle-orm";
import { t } from "elysia";

import {
	type LeaderboardPeriod,
	normalizeLeaderboardTimeZone,
	parseLeaderboardPeriod,
	resolveLeaderboardWindow,
} from "./leaderboard-period";

/** Shared `period` + `tz` query for community lobby endpoints. */
export const communityPeriodQuery = t.Object({
	period: t.Optional(
		t.Union([
			t.Literal("week"),
			t.Literal("month"),
			t.Literal("year"),
			t.Literal("all"),
		]),
	),
	tz: t.Optional(t.String()),
});

export function resolveCommunityPeriodQuery(
	query: { period?: string; tz?: string },
	now = new Date(),
): {
	period: LeaderboardPeriod;
	tz: string;
	start: Date;
	end: Date;
} {
	const period = parseLeaderboardPeriod(query.period);
	const tz = normalizeLeaderboardTimeZone(query.tz);
	const { start, end } = resolveLeaderboardWindow(period, tz, now);
	return { period, tz, start, end };
}

/** Half-open `[start, end)` filter on a timestamp column. */
export function withinCommunityPeriod(
	column: AnyColumn,
	start: Date,
	end: Date,
): SQL {
	const condition = and(gte(column, start), lt(column, end));
	if (!condition) {
		throw new Error("withinCommunityPeriod: expected a bounded date filter");
	}
	return condition;
}
