import { Elysia, t } from "elysia";

import { context } from "../context";
import { normalizeLeaderboardTimeZone } from "../lib/leaderboard-period";
import { fetchMonthRecap } from "../lib/month-recap-query";

export const monthRecapRoute = new Elysia({
	prefix: "/api/community",
	tags: ["community"],
})
	.use(context)
	.get(
		"/month-recap",
		async ({ query, user, status }) => {
			if (!user) return status(401, "Unauthorized");
			return fetchMonthRecap({
				tz: normalizeLeaderboardTimeZone(query.tz),
				viewerId: user.id,
			});
		},
		{
			query: t.Object({
				tz: t.Optional(t.String()),
			}),
		},
	);
