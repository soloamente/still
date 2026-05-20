import {
	db,
	follow,
	list,
	log,
	movie,
	profile,
	review,
	tv,
	user,
} from "@still/db";
import { desc, eq, inArray, or } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";

/**
 * Personalized activity feed: logs + reviews + new lists from people the
 * viewer follows (plus themselves), interleaved by time. v1 fetches each
 * stream separately and merges in-app so the SQL stays understandable.
 */
export const feedRoute = new Elysia({ prefix: "/api/feed", tags: ["feed"] })
	.use(context)
	.get(
		"/",
		async ({ user: viewer, status, query }) => {
			if (!viewer) return status(401, "Sign in");
			const limit = Math.min(Number(query.limit ?? 40), 80);

			const following = await db
				.select({ id: follow.followingId })
				.from(follow)
				.where(eq(follow.followerId, viewer.id));
			const ids = [viewer.id, ...following.map((f) => f.id)];

			const [logs, reviews, lists] = await Promise.all([
				db
					.select({ log, movie, tv, user, profile })
					.from(log)
					.leftJoin(movie, eq(log.movieId, movie.tmdbId))
					.leftJoin(tv, eq(log.tvId, tv.tmdbId))
					.leftJoin(user, eq(log.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(inArray(log.userId, ids))
					.orderBy(desc(log.watchedAt))
					.limit(limit),
				db
					.select({ review, movie, user, profile })
					.from(review)
					.leftJoin(movie, eq(review.movieId, movie.tmdbId))
					.leftJoin(user, eq(review.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(or(eq(review.isPublic, true)))
					.orderBy(desc(review.publishedAt))
					.limit(limit),
				db
					.select({ list, user, profile })
					.from(list)
					.leftJoin(user, eq(list.userId, user.id))
					.leftJoin(profile, eq(profile.userId, user.id))
					.where(inArray(list.userId, ids))
					.orderBy(desc(list.updatedAt))
					.limit(limit),
			]);

			const items = [
				...logs.map((row) => ({
					kind: "log" as const,
					at: row.log.watchedAt,
					payload: row,
				})),
				...reviews
					.filter((r) => ids.includes(r.review.userId))
					.map((row) => ({
						kind: "review" as const,
						at: row.review.publishedAt,
						payload: row,
					})),
				...lists.map((row) => ({
					kind: "list" as const,
					at: row.list.updatedAt,
					payload: row,
				})),
			]
				.sort((a, b) => b.at.getTime() - a.at.getTime())
				.slice(0, limit);

			return { items };
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	// Public discovery feed for the logged-out home page: trending reviews
	// and lists across the platform.
	.get("/discover", async () => {
		const [topReviews, topLists] = await Promise.all([
			db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(review.isPublic, true))
				.orderBy(desc(review.likesCount), desc(review.publishedAt))
				.limit(20),
			db
				.select({ list, user, profile })
				.from(list)
				.leftJoin(user, eq(list.userId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(list.isPublic, true))
				.orderBy(desc(list.likesCount))
				.limit(12),
		]);
		const items = [
			...topReviews.map((row) => ({
				kind: "review" as const,
				at: row.review.publishedAt,
				payload: row,
			})),
			...topLists.map((row) => ({
				kind: "list" as const,
				at: row.list.updatedAt,
				payload: row,
			})),
		].sort((a, b) => Number(b.at) - Number(a.at));
		return { items };
	});
