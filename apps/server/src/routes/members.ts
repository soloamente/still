import { Elysia, t } from "elysia";

import { context } from "../context";
import { parseCommunityPage } from "../lib/community-page-args";
import { communityPeriodQuery } from "../lib/community-period";
import {
	normalizeLeaderboardTimeZone,
	parseLeaderboardPeriod,
} from "../lib/leaderboard-period";
import { fetchMembersLeaderboardItems } from "../lib/members-leaderboard-items-query";
import {
	fetchMembersLeaderboard,
	parseMembersLeaderboardLimit,
	parseMembersLeaderboardSort,
} from "../lib/members-leaderboard-query";

export const membersRoute = new Elysia({
	prefix: "/api/members",
	tags: ["members"],
})
	.use(context)
	.get(
		"/leaderboard",
		async ({ query, user }) => {
			const sort = parseMembersLeaderboardSort(query.sort);
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const page = parseCommunityPage(query.page);
			const limit = parseMembersLeaderboardLimit(query.limit);

			return fetchMembersLeaderboard({
				sort,
				period,
				tz,
				viewerId: user?.id ?? null,
				page,
				limit,
			});
		},
		{
			query: t.Composite([
				communityPeriodQuery,
				t.Object({
					sort: t.Optional(
						t.Union([
							t.Literal("popular"),
							t.Literal("reviews"),
							t.Literal("lists"),
							t.Literal("likes"),
						]),
					),
					page: t.Optional(t.String()),
					limit: t.Optional(t.String()),
				}),
			]),
		},
	)
	.get(
		"/leaderboard/:userId/items",
		async ({ params, query, status, user }) => {
			const sort = parseMembersLeaderboardSort(query.sort);
			const period = parseLeaderboardPeriod(query.period);
			const tz = normalizeLeaderboardTimeZone(query.tz);
			const payload = await fetchMembersLeaderboardItems({
				sort,
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
			query: t.Composite([
				communityPeriodQuery,
				t.Object({
					sort: t.Optional(
						t.Union([
							t.Literal("popular"),
							t.Literal("reviews"),
							t.Literal("lists"),
							t.Literal("likes"),
						]),
					),
				}),
			]),
		},
	);
