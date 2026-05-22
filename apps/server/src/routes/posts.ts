import { db, eventLog, post, profile, reaction, user } from "@still/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { hit } from "../lib/rate-limit";
import { routeBody } from "../lib/route-body";

/** Matches `post.attachments` jsonb in @still/db. */
type PostAttachment = {
	url: string;
	kind: "image" | "gif";
	width?: number;
	height?: number;
};

type CreatePostBody = {
	body: string;
	kind?: "status" | "share" | "milestone";
	refType?: string;
	refId?: string;
	attachments?: PostAttachment[];
};

export const postsRoute = new Elysia({ prefix: "/api/posts", tags: ["posts"] })
	.use(context)
	.post(
		"/",
		async ({ body: rawBody, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			if (!hit(`post:create:${viewer.id}`, { limit: 30, windowMs: 60_000 }).ok)
				return status(429, "Slow down");
			const body = routeBody<CreatePostBody>(rawBody);
			const id = makeId("pst");
			const [row] = await db
				.insert(post)
				.values({
					id,
					userId: viewer.id,
					kind: body.kind ?? "status",
					body: body.body,
					refType: body.refType ?? null,
					refId: body.refId ?? null,
					attachments: body.attachments ?? [],
				})
				.returning();
			await db.insert(eventLog).values({
				id: makeId("evt"),
				userId: viewer.id,
				kind: "post.created",
				payload: { postId: id },
			});
			return row;
		},
		{
			body: t.Object({
				body: t.String({ minLength: 1, maxLength: 2000 }),
				kind: t.Optional(
					t.Union([
						t.Literal("status"),
						t.Literal("share"),
						t.Literal("milestone"),
					]),
				),
				refType: t.Optional(t.String()),
				refId: t.Optional(t.String()),
				attachments: t.Optional(t.Array(t.Any())),
			}),
		},
	)
	.delete(
		"/:id",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(post)
				.where(eq(post.id, params.id))
				.limit(1);
			if (!existing || existing.userId !== viewer.id)
				return status(404, "Not found");
			await db.delete(post).where(eq(post.id, params.id));
			return { ok: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.post(
		"/:id/like",
		async ({ params, user: viewer, status }) => {
			if (!viewer) return status(401, "Sign in");
			const [existing] = await db
				.select()
				.from(reaction)
				.where(
					and(
						eq(reaction.userId, viewer.id),
						eq(reaction.parentType, "post"),
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
							eq(reaction.userId, viewer.id),
							eq(reaction.parentType, "post"),
							eq(reaction.parentId, params.id),
							eq(reaction.kind, "like"),
						),
					);
				await db
					.update(post)
					.set({ likesCount: sql`greatest(${post.likesCount} - 1, 0)` })
					.where(eq(post.id, params.id));
				return { liked: false };
			}
			await db.insert(reaction).values({
				userId: viewer.id,
				parentType: "post",
				parentId: params.id,
				kind: "like",
			});
			await db
				.update(post)
				.set({ likesCount: sql`${post.likesCount} + 1` })
				.where(eq(post.id, params.id));
			return { liked: true };
		},
		{ params: t.Object({ id: t.String() }) },
	)
	.get(
		"/by-user/:userId",
		async ({ params }) => {
			const rows = await db
				.select({ post, user, profile })
				.from(post)
				.leftJoin(user, eq(post.userId, user.id))
				.leftJoin(profile, eq(profile.userId, user.id))
				.where(eq(post.userId, params.userId))
				.orderBy(desc(post.publishedAt))
				.limit(50);
			return rows;
		},
		{ params: t.Object({ userId: t.String() }) },
	);
