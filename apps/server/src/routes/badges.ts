import { achievement, badge, db, userAchievement, userBadge } from "@still/db";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	badgePrestigeScore,
	isProfileShowcaseBadge,
} from "../lib/badge-prestige";
import { routeBody } from "../lib/route-body";

/** Pin toggle payload — schema is reused in the route hook so runtime validation stays aligned. */
const pinBadgeBody = t.Object({ pinned: t.Boolean() });

type PinBadgeBody = { pinned: boolean };

export const badgesRoute = new Elysia({
	prefix: "/api/badges",
	tags: ["gamification"],
})
	.use(context)
	.get("/catalog", async () => {
		const rows = await db.select().from(badge);
		return rows.sort((a, b) => {
			const aCat = a.category ?? "";
			const bCat = b.category ?? "";
			if (aCat === "watch_milestone" && bCat !== "watch_milestone") return 1;
			if (bCat === "watch_milestone" && aCat !== "watch_milestone") return -1;
			const cat = aCat.localeCompare(bCat);
			if (cat !== 0) return cat;
			return badgePrestigeScore(b) - badgePrestigeScore(a);
		});
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
		async ({ params, user, status, body: rawBody }) => {
			if (!user) return status(401, "Sign in");
			const { pinned } = routeBody<PinBadgeBody>(rawBody);
			if (pinned) {
				const [badgeRow] = await db
					.select()
					.from(badge)
					.where(eq(badge.id, params.badgeId))
					.limit(1);
				if (
					badgeRow &&
					!isProfileShowcaseBadge({
						id: badgeRow.id,
						category: badgeRow.category,
						tier: badgeRow.tier,
						points: badgeRow.points,
					})
				) {
					return status(
						400,
						"Volume milestones stay in Achievements — only prestige badges can be pinned.",
					);
				}
			}
			await db
				.update(userBadge)
				.set({ isPinned: pinned })
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
			body: pinBadgeBody,
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
