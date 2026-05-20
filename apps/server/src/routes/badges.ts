import { achievement, badge, db, userAchievement, userBadge } from "@still/db";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";

export const badgesRoute = new Elysia({
	prefix: "/api/badges",
	tags: ["gamification"],
})
	.use(context)
	.get("/catalog", async () => {
		const rows = await db
			.select()
			.from(badge)
			.orderBy(badge.category, badge.tier);
		return rows;
	})
	.get("/me", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const rows = await db
			.select({ userBadge, badge })
			.from(userBadge)
			.leftJoin(badge, eq(userBadge.badgeId, badge.id))
			.where(eq(userBadge.userId, user.id))
			.orderBy(desc(userBadge.awardedAt));
		return rows;
	})
	// Recently awarded badges since a given timestamp. Used by the client
	// to surface "you just earned …" toasts after activity.
	.get(
		"/me/recent",
		async ({ user, status, query }) => {
			if (!user) return status(401, "Sign in");
			const since = query.since
				? new Date(query.since)
				: new Date(Date.now() - 5 * 60_000);
			const rows = await db
				.select({ userBadge, badge })
				.from(userBadge)
				.leftJoin(badge, eq(userBadge.badgeId, badge.id))
				.where(
					and(
						eq(userBadge.userId, user.id),
						sql`${userBadge.awardedAt} > ${since}`,
					),
				)
				.orderBy(desc(userBadge.awardedAt));
			return rows;
		},
		{ query: t.Object({ since: t.Optional(t.String()) }) },
	)
	.get(
		"/of/:userId",
		async ({ params }) => {
			const rows = await db
				.select({ userBadge, badge })
				.from(userBadge)
				.leftJoin(badge, eq(userBadge.badgeId, badge.id))
				.where(eq(userBadge.userId, params.userId))
				.orderBy(desc(userBadge.awardedAt));
			return rows;
		},
		{ params: t.Object({ userId: t.String() }) },
	)
	.post(
		"/me/pin/:badgeId",
		async ({ params, user, status, body }) => {
			if (!user) return status(401, "Sign in");
			await db
				.update(userBadge)
				.set({ isPinned: body.pinned })
				.where(
					and(
						eq(userBadge.userId, user.id),
						eq(userBadge.badgeId, params.badgeId),
					),
				);
			return { ok: true };
		},
		{
			params: t.Object({ badgeId: t.String() }),
			body: t.Object({ pinned: t.Boolean() }),
		},
	);

export const achievementsRoute = new Elysia({
	prefix: "/api/achievements",
	tags: ["gamification"],
})
	.use(context)
	.get("/catalog", async () => {
		const rows = await db
			.select()
			.from(achievement)
			.orderBy(achievement.points);
		return rows;
	})
	.get("/me", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		const rows = await db
			.select({ userAchievement, achievement })
			.from(userAchievement)
			.leftJoin(achievement, eq(userAchievement.achievementId, achievement.id))
			.where(eq(userAchievement.userId, user.id))
			.orderBy(desc(userAchievement.updatedAt));
		return rows;
	})
	/** Unlocked achievements only — safe for public profile pages (same visibility as `badges/of`). */
	.get(
		"/of/:userId",
		async ({ params }) => {
			const rows = await db
				.select({ userAchievement, achievement })
				.from(userAchievement)
				.leftJoin(
					achievement,
					eq(userAchievement.achievementId, achievement.id),
				)
				.where(
					and(
						eq(userAchievement.userId, params.userId),
						isNotNull(userAchievement.unlockedAt),
					),
				)
				.orderBy(desc(userAchievement.unlockedAt));
			return rows;
		},
		{ params: t.Object({ userId: t.String() }) },
	);
