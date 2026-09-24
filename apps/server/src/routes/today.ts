import { Elysia, t } from "elysia";

import { context } from "../context";
import { normalizeLeaderboardTimeZone } from "../lib/leaderboard-period";
import { fetchTodayCircleActivity } from "../lib/today-circle-activity-query";
import { parseTodayMediaParam } from "../lib/today-media";
import { fetchTodayWeekPulse } from "../lib/today-week-pulse-query";

/** Today on Sense reads for `/home` RSC — viewer-scoped, no aggregate table. */
export const todayRoute = new Elysia({ prefix: "/api/today", tags: ["today"] })
	.use(context)
	.get(
		"/week",
		async ({ query, user, status }) => {
			if (!user) return status(401, "Unauthorized");
			const media = parseTodayMediaParam(query.media);
			if (media === "invalid") return status(400, "Invalid media");
			return fetchTodayWeekPulse(
				user.id,
				normalizeLeaderboardTimeZone(query.tz),
				new Date(),
				media,
			);
		},
		{
			query: t.Object({
				tz: t.Optional(t.String()),
				media: t.Optional(t.String()),
			}),
		},
	)
	.get("/circle", async ({ user, status }) => {
		if (!user) return status(401, "Unauthorized");
		return fetchTodayCircleActivity(user.id);
	});
