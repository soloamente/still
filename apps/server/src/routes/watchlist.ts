import { db, movie, watchlistItem } from "@still/db";
import { and, desc, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import { tmdbApi } from "../lib/tmdb";

async function ensureMovie(tmdbId: number) {
  const [exists] = await db.select({ id: movie.tmdbId }).from(movie).where(eq(movie.tmdbId, tmdbId)).limit(1);
  if (exists) return;
  try {
    const detail = await tmdbApi.movieDetail(tmdbId);
    await db
      .insert(movie)
      .values({
        tmdbId: detail.id,
        title: detail.title,
        overview: detail.overview,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        releaseDate: detail.release_date ? new Date(detail.release_date) : null,
        year: detail.release_date ? Number(detail.release_date.slice(0, 4)) : null,
        runtime: detail.runtime ?? null,
        tmdbJson: detail as unknown as Record<string, unknown>,
        lastSyncedAt: new Date(),
      })
      .onConflictDoNothing();
  } catch {}
}

export const watchlistRoute = new Elysia({ prefix: "/api/watchlist", tags: ["watchlist"] })
  .use(context)
  .get("/", async ({ user, status, query }) => {
    if (!user) return status(401, "Sign in");
    const limit = Math.min(Number(query.limit ?? 60), 200);
    const rows = await db
      .select({ item: watchlistItem, movie })
      .from(watchlistItem)
      .leftJoin(movie, eq(watchlistItem.movieId, movie.tmdbId))
      .where(eq(watchlistItem.userId, user.id))
      .orderBy(desc(watchlistItem.addedAt))
      .limit(limit);
    return rows;
  }, { query: t.Object({ limit: t.Optional(t.String()) }) })
  .post(
    "/",
    async ({ body, user, status }) => {
      if (!user) return status(401, "Sign in");
      if (!hit(`wl:add:${user.id}`, { limit: 60, windowMs: 60_000 }).ok)
        return status(429, "Slow down");
      await ensureMovie(body.movieId);
      const [row] = await db
        .insert(watchlistItem)
        .values({
          userId: user.id,
          movieId: body.movieId,
          note: body.note ?? null,
          priority: body.priority ?? 50,
        })
        .onConflictDoUpdate({
          target: [watchlistItem.userId, watchlistItem.movieId],
          set: { note: body.note ?? null, priority: body.priority ?? 50 },
        })
        .returning();
      return row;
    },
    {
      body: t.Object({
        movieId: t.Number(),
        priority: t.Optional(t.Integer({ minimum: 0, maximum: 100 })),
        note: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )
  .delete(
    "/:movieId",
    async ({ params, user, status }) => {
      if (!user) return status(401, "Sign in");
      await db
        .delete(watchlistItem)
        .where(
          and(eq(watchlistItem.userId, user.id), eq(watchlistItem.movieId, Number(params.movieId))),
        );
      return { ok: true };
    },
    { params: t.Object({ movieId: t.String() }) },
  )
  .get(
    "/check/:movieId",
    async ({ params, user, status }) => {
      if (!user) return status(401, "Sign in");
      const [row] = await db
        .select()
        .from(watchlistItem)
        .where(
          and(eq(watchlistItem.userId, user.id), eq(watchlistItem.movieId, Number(params.movieId))),
        )
        .limit(1);
      return { inWatchlist: Boolean(row) };
    },
    { params: t.Object({ movieId: t.String() }) },
  );
