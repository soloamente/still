import type { ContentVisibility } from "@still/db";
import {
	comment,
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
	communityOffset,
	parseCommunityPage,
} from "../lib/community-page-args";
import {
	resolveCommunityPeriodQuery,
	withinCommunityPeriod,
} from "../lib/community-period";
import {
	canViewContent,
	contentVisibilityWhere,
	resolveViewerFollow,
	visibilitySchema,
} from "../lib/content-visibility";
import { reviewEngagementOrderSql } from "../lib/creator-recognition";
import { makeId } from "../lib/cuid";
import {
	areUsersMutualFollows,
	deliverNotification,
} from "../lib/notification-delivery";
import { removePinnedReviewId } from "../lib/profile-pinned-reviews";
import { hit } from "../lib/rate-limit";
import { movieReviewNotificationHref } from "../lib/review-notification-href";
import { isValidReviewRatingStored } from "../lib/review-rating";
import { routeBody } from "../lib/route-body";

const reviewRatingSchema = t.Optional(
	t.Union([t.Integer({ minimum: 0, maximum: 100 }), t.Null()]),
);

type CreateReviewBody = {
	movieId: number;
	logId?: string;
	title?: string;
	body: string;
	rating?: number;
	containsSpoilers?: boolean;
	visibility?: ContentVisibility;
};

type PatchReviewBody = {
	title?: string;
	body?: string;
	rating?: number;
	containsSpoilers?: boolean;
	visibility?: ContentVisibility;
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
					rating = linkedLog?.rating ?? null;
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
						rating = latestLog.rating;
					}
				}
			}

			if (rating != null && !isValidReviewRatingStored(rating)) {
				return status(400, "Invalid rating");
			}

			let visibility = body.visibility ?? null;
			if (!visibility) {
				const [own] = await db
					.select({ d: profile.defaultVisibility })
					.from(profile)
					.where(eq(profile.userId, user.id))
					.limit(1);
				visibility = own?.d ?? "public";
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
					visibility,
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
				rating: reviewRatingSchema,
				containsSpoilers: t.Optional(t.Boolean()),
				visibility: t.Optional(visibilitySchema),
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
			const nextRating =
				existing.logId != null
					? existing.rating
					: body.rating !== undefined
						? body.rating
						: existing.rating;
			if (nextRating != null && !isValidReviewRatingStored(nextRating)) {
				return status(400, "Invalid rating");
			}
			const [updated] = await db
				.update(review)
				.set({
					title: body.title ?? existing.title,
					body: body.body ?? existing.body,
					containsSpoilers: body.containsSpoilers ?? existing.containsSpoilers,
					visibility: body.visibility ?? existing.visibility,
					rating: nextRating,
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
				rating: reviewRatingSchema,
				containsSpoilers: t.Optional(t.Boolean()),
				visibility: t.Optional(visibilitySchema),
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

			const [prof] = await db
				.select({ pinnedReviewIds: profile.pinnedReviewIds })
				.from(profile)
				.where(eq(profile.userId, user.id))
				.limit(1);
			if (prof) {
				const next = removePinnedReviewId(prof.pinnedReviewIds, params.id);
				await db
					.update(profile)
					.set({ pinnedReviewIds: next })
					.where(eq(profile.userId, user.id));
			}

			await db
				.delete(reaction)
				.where(
					and(
						eq(reaction.parentType, "review"),
						eq(reaction.parentId, params.id),
					),
				);
			await db
				.delete(comment)
				.where(
					and(
						eq(comment.parentType, "review"),
						eq(comment.parentId, params.id),
					),
				);

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
			const author = row.review.userId;
			const follows = await resolveViewerFollow(user?.id ?? null, author);
			if (
				!canViewContent({
					viewerId: user?.id ?? null,
					authorId: author,
					visibility: row.review.visibility,
					...follows,
				})
			) {
				return status(404, "Not found");
			}
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
		async ({ query, user: currentUser }) => {
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const page = parseCommunityPage(query.page);
			const { start, end } = resolveCommunityPeriodQuery(query);
			const rows = await db
				.select({ review, movie, user, profile })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.leftJoin(user, eq(review.userId, user.id))
				.leftJoin(profile, eq(review.userId, profile.userId))
				.where(
					and(
						contentVisibilityWhere(
							currentUser?.id ?? null,
							review.userId,
							review.visibility,
						),
						withinCommunityPeriod(review.publishedAt, start, end),
					),
				)
				.orderBy(
					desc(reviewEngagementOrderSql()),
					desc(review.publishedAt),
					desc(review.id),
				)
				.limit(limit)
				.offset(communityOffset(page, limit));
			return rows;
		},
		{
			query: t.Object({
				limit: t.Optional(t.String()),
				page: t.Optional(t.String()),
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
		async ({ query, user: currentUser }) => {
			const limit = Math.min(Number(query.limit ?? 20), 50);
			const rows = await db
				.select({ review, movie })
				.from(review)
				.leftJoin(movie, eq(review.movieId, movie.tmdbId))
				.where(
					contentVisibilityWhere(
						currentUser?.id ?? null,
						review.userId,
						review.visibility,
					),
				)
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
