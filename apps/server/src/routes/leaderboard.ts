import { Elysia, t } from "elysia";

import { context } from "../context";
import { parseCommunityPage } from "../lib/community-page-args";
import {
	normalizeLeaderboardTimeZone,
	parseLeaderboardPeriod,
} from "../lib/leaderboard-period";
import {
	fetchLeaderboard,
	fetchLeaderboardLogs,
	parseLeaderboardLimit,
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
	page: t.Optional(t.String()),
	limit: t.Optional(t.String()),
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
			const page = parseCommunityPage(query.page);
			const limit = parseLeaderboardLimit(query.limit);
			return fetchLeaderboard({
				kind: "films",
				period,
				tz,
				viewerId: user?.id ?? null,
				page,
				limit,
			});
		},
		{ query: periodQuery },
	)
	.get(
		"/tv",
		async ({ query, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const page = parseCommunityPage(query.page);
			const limit = parseLeaderboardLimit(query.limit);
			return fetchLeaderboard({
				kind: "tv",
				period,
				tz,
				viewerId: user?.id ?? null,
				page,
				limit,
			});
		},
		{ query: periodQuery },
	)
	.get(
		"/episodes",
		async ({ query, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const page = parseCommunityPage(query.page);
			const limit = parseLeaderboardLimit(query.limit);
			return fetchLeaderboard({
				kind: "episodes",
				period,
				tz,
				viewerId: user?.id ?? null,
				page,
				limit,
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
	)
	.get(
		"/episodes/:userId/logs",
		async ({ params, query, status, user }) => {
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const payload = await fetchLeaderboardLogs({
				kind: "episodes",
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
