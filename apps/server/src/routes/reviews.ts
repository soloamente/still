import { db, eventLog, log, movie, profile, reaction, review } from "@still/db";
import { and, desc, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { hit } from "../lib/rate-limit";

export const reviewsRoute = new Elysia({ prefix: "/api/reviews", tags: ["reviews"] })
  .use(context)
  .post(
    "/",
    async ({ body, user, status }) => {
      if (!user) return status(401, "Sign in");
      if (!hit(`reviews:create:${user.id}`, { limit: 12, windowMs: 60_000 }).ok)
        return status(429, "Slow down");
      const id = makeId("rev");
      const [row] = await db
        .insert(review)
        .values({
          id,
          userId: user.id,
          movieId: body.movieId,
          logId: body.logId ?? null,
          title: body.title ?? null,
          body: body.body,
          containsSpoilers: body.containsSpoilers ?? false,
          isPublic: body.isPublic ?? true,
          rating: body.rating ?? null,
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
    async ({ params, body, user, status }) => {
      if (!user) return status(401, "Sign in");
      const [existing] = await db.select().from(review).where(eq(review.id, params.id)).limit(1);
      if (!existing || existing.userId !== user.id) return status(404, "Not found");
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
  .delete("/:id", async ({ params, user, status }) => {
    if (!user) return status(401, "Sign in");
    const [existing] = await db.select().from(review).where(eq(review.id, params.id)).limit(1);
    if (!existing || existing.userId !== user.id) return status(404, "Not found");
    await db.delete(review).where(eq(review.id, params.id));
    return { ok: true };
  }, { params: t.Object({ id: t.String() }) })
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
      const rows = await db
        .select({ review, movie })
        .from(review)
        .leftJoin(movie, eq(review.movieId, movie.tmdbId))
        .where(eq(review.isPublic, true))
        .orderBy(desc(review.publishedAt))
        .limit(limit);
      return rows;
    },
    { query: t.Object({ limit: t.Optional(t.String()) }) },
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
  .post("/:id/like", async ({ params, user, status }) => {
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
    return { liked: true };
  }, { params: t.Object({ id: t.String() }) });
