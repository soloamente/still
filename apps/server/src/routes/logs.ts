import { db, eventLog, log, movie } from "@still/db";
import { and, desc, eq } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { makeId } from "../lib/cuid";
import { hit } from "../lib/rate-limit";
import { tmdbApi } from "../lib/tmdb";

async function ensureMovieCached(tmdbId: number) {
  const [exists] = await db.select({ id: movie.tmdbId }).from(movie).where(eq(movie.tmdbId, tmdbId)).limit(1);
  if (exists) return;
  try {
    const detail = await tmdbApi.movieDetail(tmdbId);
    const releaseDate = detail.release_date ?? null;
    await db
      .insert(movie)
      .values({
        tmdbId: detail.id,
        title: detail.title,
        overview: detail.overview,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
        runtime: detail.runtime ?? null,
        genreIds: (detail.genres ?? []).map((g) => g.id),
        spokenLanguages: (detail.spoken_languages ?? []).map((l) => l.iso_639_1),
        originalLanguage: detail.original_language ?? null,
        popularity: detail.popularity ?? null,
        voteAverage: detail.vote_average ?? null,
        voteCount: detail.vote_count ?? null,
        tmdbJson: detail as unknown as Record<string, unknown>,
        lastSyncedAt: new Date(),
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("[logs] failed to cache movie from TMDb", err);
  }
}

export const logsRoute = new Elysia({ prefix: "/api/logs", tags: ["logs"] })
  .use(context)
  .post(
    "/",
    async ({ body, user, status }) => {
      if (!user) return status(401, "Sign in to log a film");
      if (!hit(`logs:create:${user.id}`, { limit: 30, windowMs: 60_000 }).ok) {
        return status(429, "Slow down");
      }
      await ensureMovieCached(body.movieId);

      const id = makeId("log");
      const watchedAt = body.watchedAt ? new Date(body.watchedAt) : new Date();
      const [row] = await db
        .insert(log)
        .values({
          id,
          userId: user.id,
          movieId: body.movieId,
          watchedAt,
          rating: body.rating ?? null,
          liked: body.liked ?? false,
          rewatch: body.rewatch ?? false,
          note: body.note ?? null,
          containsSpoilers: body.containsSpoilers ?? false,
        })
        .returning();

      // Emit an event for the badge evaluator.
      await db.insert(eventLog).values({
        id: makeId("evt"),
        userId: user.id,
        kind: "log.created",
        payload: { logId: id, movieId: body.movieId, rating: body.rating, liked: body.liked },
      });

      return row;
    },
    {
      body: t.Object({
        movieId: t.Number(),
        rating: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
        liked: t.Optional(t.Boolean()),
        rewatch: t.Optional(t.Boolean()),
        watchedAt: t.Optional(t.String()),
        note: t.Optional(t.String({ maxLength: 500 })),
        containsSpoilers: t.Optional(t.Boolean()),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, user, status }) => {
      if (!user) return status(401, "Sign in");
      const [existing] = await db.select().from(log).where(eq(log.id, params.id)).limit(1);
      if (!existing || existing.userId !== user.id) return status(404, "Log not found");
      const [updated] = await db
        .update(log)
        .set({
          rating: body.rating ?? existing.rating,
          liked: body.liked ?? existing.liked,
          rewatch: body.rewatch ?? existing.rewatch,
          note: body.note ?? existing.note,
          watchedAt: body.watchedAt ? new Date(body.watchedAt) : existing.watchedAt,
          containsSpoilers: body.containsSpoilers ?? existing.containsSpoilers,
        })
        .where(eq(log.id, params.id))
        .returning();
      return updated;
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        rating: t.Optional(t.Integer({ minimum: 1, maximum: 10 })),
        liked: t.Optional(t.Boolean()),
        rewatch: t.Optional(t.Boolean()),
        watchedAt: t.Optional(t.String()),
        note: t.Optional(t.String({ maxLength: 500 })),
        containsSpoilers: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete("/:id", async ({ params, user, status }) => {
    if (!user) return status(401, "Sign in");
    const [existing] = await db.select().from(log).where(eq(log.id, params.id)).limit(1);
    if (!existing || existing.userId !== user.id) return status(404, "Log not found");
    await db.delete(log).where(eq(log.id, params.id));
    return { ok: true };
  }, { params: t.Object({ id: t.String() }) })
  // My diary — convenience endpoint for the signed-in user.
  .get("/me", async ({ user, status, query }) => {
    if (!user) return status(401, "Sign in");
    const limit = Math.min(Number(query.limit ?? 60), 200);
    const rows = await db
      .select({ log, movie })
      .from(log)
      .leftJoin(movie, eq(log.movieId, movie.tmdbId))
      .where(eq(log.userId, user.id))
      .orderBy(desc(log.watchedAt))
      .limit(limit);
    return rows;
  }, { query: t.Object({ limit: t.Optional(t.String()) }) })
  // Diary endpoint: a user's chronologically-ordered logs.
  .get("/by-user/:userId", async ({ params, query }) => {
    const limit = Math.min(Number(query.limit ?? 30), 100);
    const rows = await db
      .select({
        log,
        movie,
      })
      .from(log)
      .leftJoin(movie, eq(log.movieId, movie.tmdbId))
      .where(eq(log.userId, params.userId))
      .orderBy(desc(log.watchedAt))
      .limit(limit);
    return rows;
  }, {
    params: t.Object({ userId: t.String() }),
    query: t.Object({ limit: t.Optional(t.String()) }),
  })
  // Has-the-current-user-already-logged-this-movie? Used by the rating widget.
  .get(
    "/me/by-movie/:movieId",
    async ({ params, user, status }) => {
      if (!user) return status(401, "Sign in");
      const rows = await db
        .select()
        .from(log)
        .where(and(eq(log.userId, user.id), eq(log.movieId, Number(params.movieId))))
        .orderBy(desc(log.watchedAt));
      return rows;
    },
    { params: t.Object({ movieId: t.String() }) },
  );
