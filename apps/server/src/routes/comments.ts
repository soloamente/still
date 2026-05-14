import { comment, db, eventLog, profile, review, user } from "@still/db";
import { and, asc, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { hit } from "../lib/rate-limit";

const parentTypes = ["review", "post", "list", "comment", "log"] as const;
type ParentType = (typeof parentTypes)[number];

export const commentsRoute = new Elysia({ prefix: "/api/comments", tags: ["comments"] })
  .use(context)
  .post(
    "/",
    async ({ body, user: viewer, status }) => {
      if (!viewer) return status(401, "Sign in");
      if (!hit(`comment:${viewer.id}`, { limit: 60, windowMs: 60_000 }).ok)
        return status(429, "Slow down");
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
        payload: { commentId: id, parentType: body.parentType, parentId: body.parentId },
      });
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
  .delete("/:id", async ({ params, user: viewer, status }) => {
    if (!viewer) return status(401, "Sign in");
    const [existing] = await db.select().from(comment).where(eq(comment.id, params.id)).limit(1);
    if (!existing || existing.userId !== viewer.id) return status(404, "Not found");
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
  }, { params: t.Object({ id: t.String() }) })
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
