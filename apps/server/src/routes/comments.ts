import { comment, db, eventLog, profile, review, user } from "@still/db";
import { and, asc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { notifyOnReviewComment } from "../lib/notification-delivery";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";

type CreateCommentBody = {
	parentType: string;
	parentId: string;
	body: string;
	replyToId?: string;
};

const parentTypes = ["review", "post", "list", "comment", "log"] as const;
type ParentType = (typeof parentTypes)[number];

export const commentsRoute = new Elysia({
	prefix: "/api/comments",
	tags: ["comments"],
})
	.use(context)
	.post(
		"/",
		async ({ body: rawBody, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			if (!hit(`comment:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<CreateCommentBody>(rawBody);
			if (!parentTypes.includes(body.parentType as ParentType))
				return status(400, "Bad parentType");

			const id = makeId("cmt");
			const [row] = await db
				.insert(comment)
				.values({
					id,
					parentType: body.parentType as ParentType,
					parentId: body.parentId,
					userId: viewer.id,
					body: body.body,
					replyToId: body.replyToId ?? null,
				})
				.returning();

			// Bump the denormalized counter on the parent (only review for v1; lists/posts later).
			if (body.parentType === "review") {
				await db
					.update(review)
					.set({ commentsCount: sql`${review.commentsCount} + 1` })
					.where(eq(review.id, body.parentId));
			}
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: viewer.id,
				kind: "comment.created",
				payload: {
					commentId: id,
					parentType: body.parentType,
					parentId: body.parentId,
				},
			});

			if (body.parentType === "review") {
				const [reviewRow] = await db
					.select({
						userId: review.userId,
						movieId: review.movieId,
						title: review.title,
					})
					.from(review)
					.where(eq(review.id, body.parentId))
					.limit(1);
				let replyToUserId: string | null = null;
				if (body.replyToId) {
					const [parentComment] = await db
						.select({ userId: comment.userId })
						.from(comment)
						.where(eq(comment.id, body.replyToId))
						.limit(1);
					replyToUserId = parentComment?.userId ?? null;
				}
				const [commenterProfile] = await db
					.select({ displayName: profile.displayName })
					.from(profile)
					.where(eq(profile.userId, viewer.id))
					.limit(1);
				if (reviewRow?.movieId != null) {
					await notifyOnReviewComment({
						reviewId: body.parentId,
						movieId: reviewRow.movieId,
						reviewAuthorId: reviewRow.userId,
						commenterId: viewer.id,
						commenterDisplayName:
							commenterProfile?.displayName ?? viewer.name ?? "Someone",
						replyToUserId,
						reviewTitle: reviewRow.title,
					});
				}
			}

			return row;
		},
		{
			body: t.Object({
				parentType: t.String(),
				parentId: t.String(),
				body: t.String({ minLength: 1, maxLength: 4000 }),
				replyToId: t.Optional(t.String()),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(comment)
				.where(eq(comment.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== viewer.id)
				return status(404, "Not found");
			await db
				.update(comment)
				.set({ deletedAt: new Date(), body: "[deleted]" })
				.where(eq(comment.id, params.id));
			if (existing.parentType === "review") {
				await db
					.update(review)
					.set({ commentsCount: sql`greatest(${review.commentsCount} - 1, 0)` })
					.where(eq(review.id, existing.parentId));
			}
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/of/:parentType/:parentId",
		async ({ params }) => {
			const rows = await db
				.select({ comment, user, profile })
				.from(comment)
				.leftJoin(user, eq(comment.userId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(
					and(
						eq(comment.parentType, params.parentType as ParentType),
						eq(comment.parentId, params.parentId),
					),
				)
				.orderBy(asc(comment.createdAt));
			return rows;
		},
		{ params: t.Object({ parentType: t.String(), parentId: t.String() }) },
	);
