import {
	db,
	eventLog,
	log,
	movie,
	profile,
	reaction,
	review,
	user,
} from "@still/db";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import {
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import { reviewEngagementOrderSql } from "../lib/creator-recognition";
import { makeId } from "../lib/cuid";
import {
	areUsersMutualFollows,
	deliverNotification,
} from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import { movieReviewNotificationHref } from "../lib/review-notification-href";
import { routeBody } from "../lib/route-body";
import { storedRatingToDisplayTen } from "../lib/sense-taste-overlap";

function diaryStoredToReviewApiRating(stored: number | null): number | null {
	if (stored == null) return null;
	const display = storedRatingToDisplayTen(stored);
	const rounded = Math.round(display);
	if (rounded < 1) return null;
	return Math.min(10, rounded);
}

type CreateReviewBody = {
	movieId: number;
	logId?: string;
	title?: string;
	body: string;
	rating?: number;
	containsSpoilers?: boolean;
	isPublic?: boolean;
};

type PatchReviewBody = {
	title?: string;
	body?: string;
	rating?: number;
	containsSpoilers?: boolean;
	isPublic?: boolean;
};

export const reviewsRoute = new Elysia({
	prefix: "/api/reviews",
	tags: ["reviews"],
})
	.use(context)
	.post(
		"/",
		async ({ body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (!hit(`reviews:create:${user.id}`, { limit: 12, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<CreateReviewBody>(rawBody);
			let logId = body.logId ?? null;
			let rating = body.rating ?? null;

			if (rating == null) {
				if (logId) {
					const [linkedLog] = await db
						.select({ rating: log.rating })
						.from(log)
						.where(and(eq(log.id, logId), eq(log.userId, user.id)))
						.limit(1);
					rating = diaryStoredToReviewApiRating(linkedLog?.rating ?? null);
				} else {
					const [latestLog] = await db
						.select({ id: log.id, rating: log.rating })
						.from(log)
						.where(
							and(
								eq(log.userId, user.id),
								eq(log.movieId, body.movieId),
								isNotNull(log.rating),
							),
						)
						.orderBy(desc(log.watchedAt))
						.limit(1);
					if (latestLog) {
						logId = latestLog.id;
						rating = diaryStoredToReviewApiRating(latestLog.rating);
					}
				}
			}

			const id = makeId("rev");
			const [row] = await db
				.insert(review)
				.values({
					id,
					userId: user.id,
					movieId: body.movieId,
					logId,
					title: body.title ?? null,
					body: body.body,
					containsSpoilers: body.containsSpoilers ?? false,
					isPublic: body.isPublic ?? true,
					rating,
				})
				.returning();
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: user.id,
				kind: "review.created",
				payload: { reviewId: id, movieId: body.movieId },
			});
			return row;
		},
		{
			body: t.Object({
				movieId: t.Number(),
				logId: t.Optional(t.String()),
				title: t.Optional(t.String({ maxLength: 200 })),
				body: t.String({ minLength: 1, maxLength: 20_000 }),
				rating: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
				containsSpoilers: t.Optional(t.Boolean()),
				isPublic: t.Optional(t.Boolean()),
			}),
		},
	)
	.patch(
		"/:id",
		async ({ params, body: rawBody, user, status }) => {
			if (!user) return status(401, "Sign in");
			const body = routeBody<PatchReviewBody>(rawBody);
			const [existing] = await db
				.select()
				.from(review)
				.where(eq(review.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			const [updated] = await db
				.update(review)
				.set({
					title: body.title ?? existing.title,
					body: body.body ?? existing.body,
					containsSpoilers: body.containsSpoilers ?? existing.containsSpoilers,
					isPublic: body.isPublic ?? existing.isPublic,
					rating: body.rating ?? existing.rating,
				})
				.where(eq(review.id, params.id))
				.returning();
			return updated;
		},
		{
			params: t.Object({ id: t.String() }),
			body: t.Object({
				title: t.Optional(t.String({ maxLength: 200 })),
				body: t.Optional(t.String({ maxLength: 20_000 })),
				rating: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
				containsSpoilers: t.Optional(t.Boolean()),
				isPublic: t.Optional(t.Boolean()),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(review)
				.where(eq(review.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== user.id)
				return status(404, "Not found");
			await db.delete(review).where(eq(review.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/:id",
		async ({ params, status, user }) => {
			const [row] = await db
				.select({ review, movie, log, authorProfile: profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(log, eq(review.logId, log.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(eq(review.id, params.id))
				.limit(1);
			if (!row) return status(404, "Not found");
			// Is the current user liking this?
			let liked = false;
			if (user) {
				const [r] = await db
					.select({ id: reaction.parentId })
					.from(reaction)
					.where(
						and(
							eq(reaction.userId, user.id),
							eq(reaction.parentType, "review"),
							eq(reaction.parentId, params.id),
							eq(reaction.kind, "like"),
						),
					)
					.limit(1);
				liked = Boolean(r);
			}
			const likedByProfiles = await db
				.select({
					displayName: profile.displayName,
					handle: profile.handle,
				})
				.from(reaction)
				.innerJoin(profile, eq(reaction.userId, profile.userId))
				.where(
					and(
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
						eq(reaction.kind, "like"),
					),
				)
				.orderBy(desc(reaction.createdAt))
				.limit(40);
			return {
				...row,
				liked,
				likedByProfiles,
			};
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/recent",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(
					and(
						eq(review.isPublic, true),
						withinCommunityPeriod(review.publishedAt, start, end),
					),
				)
				.orderBy(desc(reviewEngagementOrderSql()), desc(review.publishedAt))
				.limit(limit);
			return rows;
		},
		{
			query: t.Object({
				limit: t.Optional(t.String()),
				period: t.Optional(
					t.Union([
						t.Literal("week"),
						t.Literal("month"),
						t.Literal("year"),
						t.Literal("all"),
					]),
				),
				tz: t.Optional(t.String()),
			}),
		},
	)
	.get(
		"/popular",
		async ({ query }) => {
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const rows = await db
				.select({ review, movie })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.where(eq(review.isPublic, true))
				.orderBy(desc(review.likesCount), desc(review.publishedAt))
				.limit(limit);
			return rows;
		},
		{ query: t.Object({ limit: t.Optional(t.String()) }) },
	)
	// Toggle a like reaction. Uses the generic `reaction` table; updates
	// the denormalized counter on the review row.
	.post(
		"/:id/like",
		async ({ params, user, status }) => {
			if (!user) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(reaction)
				.where(
					and(
						eq(reaction.userId, user.id),
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
						eq(reaction.kind, "like"),
					),
				)
				.limit(1);
			if (existing) {
				await db
					.delete(reaction)
					.where(
						and(
							eq(reaction.userId, user.id),
							eq(reaction.parentType, "review"),
							eq(reaction.parentId, params.id),
							eq(reaction.kind, "like"),
						),
					);
				await db
					.update(review)
					.set({ likesCount: sql`greatest(${review.likesCount} - 1, 0)` })
					.where(eq(review.id, params.id));
				return { liked: false };
			}
			await db.insert(reaction).values({
				userId: user.id,
				parentType: "review",
				parentId: params.id,
				kind: "like",
			});
			await db
				.update(review)
				.set({ likesCount: sql`${review.likesCount} + 1` })
				.where(eq(review.id, params.id));
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: user.id,
				kind: "review.liked",
				payload: { reviewId: params.id },
			});

			const [reviewRow] = await db
				.select({
					userId: review.userId,
					movieId: review.movieId,
					title: review.title,
				})
				.from(review)
				.where(eq(review.id, params.id))
				.limit(1);
			if (
				reviewRow &&
				reviewRow.userId !== user.id &&
				reviewRow.movieId != null
			) {
				const isMutual = await areUsersMutualFollows(user.id, reviewRow.userId);
				const [likerProfile] = await db
					.select({ displayName: profile.displayName })
					.from(profile)
					.where(eq(profile.userId, user.id))
					.limit(1);
				const from =
					likerProfile?.displayName?.trim() || user.name?.trim() || "Someone";
				await deliverNotification({
					userId: reviewRow.userId,
					kind: "review.liked",
					title: `${from} liked your review`,
					payload: {
						fromUserId: user.id,
						reviewId: params.id,
						movieId: reviewRow.movieId,
						href: movieReviewNotificationHref(reviewRow.movieId, params.id),
					},
					context: { actorUserId: user.id, isMutual },
				});
			}

			return { liked: true };
		},
		{ params: t.Object({ id: t.String() }) },
	);
