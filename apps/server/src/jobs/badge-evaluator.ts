import {
	achievement,
	badge,
	comment,
	db,
	eventLog,
	follow,
	list,
	log,
	notification,
	review,
	userAchievement,
	userBadge,
} from "@still/db";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { makeId } from "../lib/cuid";

type Criteria = Record<string, unknown> & { kind: string };

/**
 * Snapshot of a user's stats relevant for evaluating badges/achievements.
 * Recomputed on every evaluation pass for simplicity — cheap enough at
 * v1 scale (single user, small tables).
 */
async function snapshot(userId: string) {
	const [logs] = await db
		.select({ c: count(log.id) })
		.from(log)
		.where(eq(log.userId, userId));
	const [followers] = await db
		.select({ c: count(follow.followerId) })
		.from(follow)
		.where(eq(follow.followingId, userId));
	const [following] = await db
		.select({ c: count(follow.followingId) })
		.from(follow)
		.where(eq(follow.followerId, userId));
	const [reviews] = await db
		.select({ c: count(review.id) })
		.from(review)
		.where(eq(review.userId, userId));
	const [lists] = await db
		.select({ c: count(list.id) })
		.from(list)
		.where(eq(list.userId, userId));
	const [comments] = await db
		.select({ c: count(comment.id) })
		.from(comment)
		.where(eq(comment.userId, userId));

	// Genre counts via TMDb genre ids cached on `movie`.
	const genres = await db.execute<{ gid: number; c: number }>(sql`
    select g.gid::int as gid, count(*)::int as c
    from log l
    join movie m on m.tmdb_id = l.movie_id
    cross join lateral jsonb_array_elements_text(m.genre_ids) as g(gid)
    where l.user_id = ${userId}
    group by g.gid
  `);

	const decades = await db.execute<{ decade: number; c: number }>(sql`
    select (m.year / 10) * 10 as decade, count(*)::int as c
    from log l
    join movie m on m.tmdb_id = l.movie_id
    where l.user_id = ${userId} and m.year is not null
    group by decade
  `);

	const languages = await db.execute<{ lang: string; c: number }>(sql`
    select m.original_language as lang, count(distinct m.tmdb_id)::int as c
    from log l
    join movie m on m.tmdb_id = l.movie_id
    where l.user_id = ${userId} and m.original_language is not null
    group by m.original_language
  `);

	const topReview = await db
		.select({ likes: review.likesCount })
		.from(review)
		.where(eq(review.userId, userId))
		.orderBy(desc(review.likesCount))
		.limit(1);

	return {
		logsCount: Number(logs?.c ?? 0),
		followers: Number(followers?.c ?? 0),
		following: Number(following?.c ?? 0),
		reviewsCount: Number(reviews?.c ?? 0),
		listsCount: Number(lists?.c ?? 0),
		commentsCount: Number(comments?.c ?? 0),
		genreCounts: new Map(
			(genres.rows ?? []).map((r) => [Number(r.gid), Number(r.c)]),
		),
		decadeCounts: new Map(
			(decades.rows ?? []).map((r) => [Number(r.decade), Number(r.c)]),
		),
		languageCount: (languages.rows ?? []).length,
		topReviewLikes: topReview[0]?.likes ?? 0,
	};
}

type Snapshot = Awaited<ReturnType<typeof snapshot>>;

function meetsCriteria(c: Criteria, s: Snapshot): boolean {
	switch (c.kind) {
		case "logs_count":
			return s.logsCount >= Number(c.min ?? 0);
		case "reviews_count":
			return s.reviewsCount >= Number(c.min ?? 0);
		case "followers_count":
			return s.followers >= Number(c.min ?? 0);
		case "following_count":
			return s.following >= Number(c.min ?? 0);
		case "lists_count":
			return s.listsCount >= Number(c.min ?? 0);
		case "genre_count":
			return (s.genreCounts.get(Number(c.genreId)) ?? 0) >= Number(c.min ?? 0);
		case "decade_coverage": {
			const required = Number(c.min ?? 1);
			let coveredDecades = 0;
			for (const [, count] of s.decadeCounts)
				if (count >= required) coveredDecades += 1;
			return coveredDecades >= Number(c.minDecades ?? 5);
		}
		case "languages_count":
			return s.languageCount >= Number(c.min ?? 0);
		case "review_likes":
			return s.topReviewLikes >= Number(c.min ?? 0);
		default:
			return false;
	}
}

async function awardBadge(
	userId: string,
	badgeRow: typeof badge.$inferSelect,
	ctx: Record<string, unknown>,
) {
	await db
		.insert(userBadge)
		.values({
			userId,
			badgeId: badgeRow.id,
			earnedContext: ctx,
		})
		.onConflictDoNothing();
	await db.insert(notification).values({
		id: makeId("ntf"),
		userId,
		kind: "badge.awarded",
		title: `Badge unlocked: ${badgeRow.name}`,
		body: badgeRow.description,
		payload: {
			badgeId: badgeRow.id,
			tier: badgeRow.tier,
			points: badgeRow.points,
			iconUrl: badgeRow.iconUrl,
			href: "/achievements",
		},
	});
}

async function progressAchievement(
	userId: string,
	a: typeof achievement.$inferSelect,
	s: Snapshot,
) {
	// Map criteria to a "progress" number where applicable.
	const c = a.criteria as Criteria;
	let value: number | null = null;
	if (c.kind === "logs_count") value = s.logsCount;
	if (c.kind === "reviews_count") value = s.reviewsCount;
	if (c.kind === "followers_count") value = s.followers;
	if (c.kind === "languages_count") value = s.languageCount;
	if (value == null) return;

	const met = meetsCriteria(c, s);
	await db
		.insert(userAchievement)
		.values({
			userId,
			achievementId: a.id,
			progress: value,
			unlockedAt: met ? new Date() : null,
		})
		.onConflictDoUpdate({
			target: [userAchievement.userId, userAchievement.achievementId],
			set: {
				progress: value,
				unlockedAt: met ? new Date() : null,
				updatedAt: new Date(),
			},
		});
	if (met) {
		await db.insert(notification).values({
			id: makeId("ntf"),
			userId,
			kind: "achievement.unlocked",
			title: `Achievement unlocked: ${a.name}`,
			body: a.description,
			payload: { achievementId: a.id, points: a.points, href: "/achievements" },
		});
	}
}

/**
 * Drain the event_log table, then for every distinct user with new events,
 * recompute their snapshot and re-evaluate every badge/achievement.
 *
 * Idempotent. Safe to run on a tight schedule (1–5 minutes).
 */
export async function runEvaluator() {
	const unprocessed = await db
		.select({ id: eventLog.id, userId: eventLog.userId })
		.from(eventLog)
		.where(isNull(eventLog.processedAt))
		.limit(500);
	if (unprocessed.length === 0) return;

	const usersToCheck = new Set(unprocessed.map((e) => e.userId));
	const badgeRows = await db.select().from(badge);
	const achievementRows = await db.select().from(achievement);

	for (const userId of usersToCheck) {
		const s = await snapshot(userId);

		for (const b of badgeRows) {
			if (meetsCriteria(b.criteria as Criteria, s)) {
				const [existing] = await db
					.select()
					.from(userBadge)
					.where(and(eq(userBadge.userId, userId), eq(userBadge.badgeId, b.id)))
					.limit(1);
				if (!existing)
					await awardBadge(userId, b, { snapshot: { logs: s.logsCount } });
			}
		}

		for (const a of achievementRows) {
			await progressAchievement(userId, a, s);
		}
	}

	// Mark events processed. Use `inArray` — `ANY(${ids})` binds as a scalar
	// string with Neon/Drizzle and Postgres rejects it as a malformed array.
	const ids = unprocessed.map((e) => e.id);
	await db
		.update(eventLog)
		.set({ processedAt: new Date() })
		.where(inArray(eventLog.id, ids));
}
