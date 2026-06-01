import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	normalizeLeaderboardTimeZone,
	parseLeaderboardPeriod,
} from "../lib/leaderboard-period";
import {
	fetchLeaderboard,
	fetchLeaderboardLogs,
} from "../lib/leaderboard-query";

const periodQuery = t.Object({
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

export const leaderboardRoute = new Elysia({
	prefix: "/api/leaderboard",
	tags: ["leaderboard"],
})
	.use(context)
	.get(
		"/films",
		async ({ query, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			return fetchLeaderboard({
				kind: "films",
				period,
				tz,
				viewerId: user?.id ?? null,
			});
		},
		{ query: periodQuery },
	)
	.get(
		"/tv",
		async ({ query, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			return fetchLeaderboard({
				kind: "tv",
				period,
				tz,
				viewerId: user?.id ?? null,
			});
		},
		{ query: periodQuery },
	)
	.get(
		"/films/:userId/logs",
		async ({ params, query, status, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const payload = await fetchLeaderboardLogs({
				kind: "films",
				userId: params.userId,
				period,
				tz,
				viewerId: user?.id ?? null,
			});
			if (!payload) return status(404, "Profile not found");
			return payload;
		},
		{
			params: t.Object({ userId: t.String() }),
			query: periodQuery,
		},
	)
	.get(
		"/tv/:userId/logs",
		async ({ params, query, status, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const payload = await fetchLeaderboardLogs({
				kind: "tv",
				userId: params.userId,
				period,
				tz,
				viewerId: user?.id ?? null,
			});
			if (!payload) return status(404, "Profile not found");
			return payload;
		},
		{
			params: t.Object({ userId: t.String() }),
			query: periodQuery,
		},
	);
