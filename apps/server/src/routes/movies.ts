import { db, movie, movieCredit, person, review } from "@still/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import { context } from "../context";
import { env } from "@still/env/server";
import { syncMoviePosterPalette } from "../lib/sync-movie-palette";
import { tmdbApi, tmdbImg, type TmdbMovieDetail } from "../lib/tmdb";

/** Returned when `TMDB_API_KEY` is missing so the UI can explain empty rails/search. */
const TMDB_UNCONFIGURED = {
  code: "TMDB_UNCONFIGURED" as const,
  hint: "Add TMDB_API_KEY to apps/server .env (API key from https://www.themoviedb.org/settings/api). Restart the API server after saving.",
};

function tmdbUnconfiguredPaged(page: number) {
  return {
    page,
    total_pages: 0,
    total_results: 0,
    results: [] as unknown[],
    ...TMDB_UNCONFIGURED,
  };
}

/**
 * Cache a TMDb detail response into the local `movie` + `person` + `movie_credit`
 * tables. Idempotent: every call upserts. Returns the saved movie row.
 */
async function cacheDetail(detail: TmdbMovieDetail) {
  const releaseDate = detail.release_date ?? null;
  await db
    .insert(movie)
    .values({
      tmdbId: detail.id,
      imdbId: detail.imdb_id ?? null,
      title: detail.title,
      originalTitle: detail.original_title ?? null,
      tagline: detail.tagline ?? null,
      overview: detail.overview,
      posterPath: detail.poster_path,
      backdropPath: detail.backdrop_path,
      runtime: detail.runtime ?? null,
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
      genreIds: (detail.genres ?? []).map((g) => g.id),
      spokenLanguages: (detail.spoken_languages ?? []).map((l) => l.iso_639_1),
      originalLanguage: detail.original_language ?? null,
      status: detail.status ?? null,
      popularity: detail.popularity ?? null,
      voteAverage: detail.vote_average ?? null,
      voteCount: detail.vote_count ?? null,
      adult: false,
      tmdbJson: detail as unknown as Record<string, unknown>,
      lastSyncedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: movie.tmdbId,
      set: {
        title: detail.title,
        overview: detail.overview,
        posterPath: detail.poster_path,
        backdropPath: detail.backdrop_path,
        tmdbJson: detail as unknown as Record<string, unknown>,
        lastSyncedAt: new Date(),
        popularity: detail.popularity ?? null,
        voteAverage: detail.vote_average ?? null,
      },
    });

  // Best-effort: upsert credits. We don't fail the request if this errors.
  try {
    const cast = detail.credits?.cast ?? [];
    const crew = detail.credits?.crew ?? [];
    const all = [
      ...cast.map((c) => ({ ...c, department: "Cast" as const })),
      ...crew.map((c) => ({ ...c })),
    ];
    if (all.length) {
      // First upsert all unique people.
      const people = new Map<number, (typeof all)[number]>();
      for (const c of all) if (!people.has(c.id)) people.set(c.id, c);
      await db
        .insert(person)
        .values(
          Array.from(people.values()).map((p) => ({
            tmdbId: p.id,
            name: p.name,
            profilePath: p.profile_path ?? null,
            knownForDepartment: p.known_for_department ?? null,
            popularity: p.popularity ?? null,
          })),
        )
        .onConflictDoNothing();
      // Then credit rows.
      await db
        .insert(movieCredit)
        .values(
          all.map((c) => ({
            movieId: detail.id,
            personId: c.id,
            creditId: c.credit_id,
            department: (c.department as string) ?? "Cast",
            job: (c.job as string) ?? null,
            character: (c.character as string) ?? null,
            order: (c.order as number) ?? null,
          })),
        )
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error("[movies] failed to cache credits", err);
  }

  await syncMoviePosterPalette(detail.id, detail.poster_path);
}

/**
 * Cached rows can be "fresh" by time but still lack newer `append_to_response`
 * payloads (e.g. `keywords`). Without this, the UI never picks up new sections
 * until the 7‑day stale window elapses.
 */
function tmdbJsonNeedsEnrichment(tmdbJson: unknown): boolean {
  if (tmdbJson == null || typeof tmdbJson !== "object") return true;
  const o = tmdbJson as Record<string, unknown>;
  if (!("keywords" in o)) return true;
  if (!("recommendations" in o)) return true;
  return false;
}

const STALE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export const moviesRoute = new Elysia({ prefix: "/api/movies", tags: ["movies"] })
  .use(context)
  // Search — TMDb passthrough, paged. We don't cache search hits to keep
  // the local DB clean of one-off lookups.
  .get(
    "/search",
    async ({ query }) => {
      const q = (query.q ?? "").trim();
      if (!q) return { results: [], total_pages: 0, total_results: 0, page: 1 };
      if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(Number(query.page ?? 1) || 1);
      const data = await tmdbApi.searchMovies(q, Number(query.page ?? 1));
      return {
        ...data,
        results: data.results.map((m) => ({
          ...m,
          poster_url: tmdbImg.poster(m.poster_path),
          backdrop_url: tmdbImg.backdrop(m.backdrop_path),
        })),
      };
    },
    {
      query: t.Object({
        q: t.Optional(t.String()),
        page: t.Optional(t.String()),
      }),
    },
  )
  .get("/popular", async ({ query }) => {
    const page = Number(query.page ?? 1) || 1;
    if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
    const data = await tmdbApi.popular(page);
    return {
      ...data,
      results: data.results.map((m) => ({
        ...m,
        poster_url: tmdbImg.poster(m.poster_path),
        backdrop_url: tmdbImg.backdrop(m.backdrop_path),
      })),
    };
  }, { query: t.Object({ page: t.Optional(t.String()) }) })
  .get("/upcoming", async ({ query }) => {
    const page = Number(query.page ?? 1) || 1;
    if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
    const data = await tmdbApi.upcoming(page);
    return {
      ...data,
      results: data.results.map((m) => ({
        ...m,
        poster_url: tmdbImg.poster(m.poster_path),
        backdrop_url: tmdbImg.backdrop(m.backdrop_path),
      })),
    };
  }, { query: t.Object({ page: t.Optional(t.String()) }) })
  .get("/trending", async ({ query }) => {
    const page = Number(query.page ?? 1) || 1;
    if (!env.TMDB_API_KEY) return tmdbUnconfiguredPaged(page);
    const data = await tmdbApi.trending((query.window as "day" | "week") ?? "day", page);
    return {
      ...data,
      results: data.results.map((m) => ({
        ...m,
        poster_url: tmdbImg.poster(m.poster_path),
        backdrop_url: tmdbImg.backdrop(m.backdrop_path),
      })),
    };
  }, { query: t.Object({ window: t.Optional(t.String()), page: t.Optional(t.String()) }) })
  // Movie detail. We check the local cache first; if stale or missing,
  // fetch from TMDb and upsert.
  .get(
    "/:id",
    async ({ params, status }) => {
      const id = Number(params.id);
      if (!Number.isFinite(id)) return status(400, "Invalid id");

      const [existing] = await db.select().from(movie).where(eq(movie.tmdbId, id)).limit(1);
      const staleByTime = !existing || Date.now() - existing.lastSyncedAt.getTime() > STALE_MS;
      const staleByShape = tmdbJsonNeedsEnrichment(existing?.tmdbJson);
      const isStale = staleByTime || staleByShape;

      let detail: TmdbMovieDetail | undefined;
      if (isStale) {
        try {
          detail = await tmdbApi.movieDetail(id);
          await cacheDetail(detail);
        } catch (err) {
          console.error("[movies] tmdb detail failed; serving cached", err);
          if (!existing) return status(404, "Movie not found");
        }
      }

      const [row] = await db.select().from(movie).where(eq(movie.tmdbId, id)).limit(1);
      if (!row) return status(404, "Movie not found");

      // Aggregate community stats — average rating, review count.
      const stats = await db
        .select({
          avgRating: sql<number>`avg(${review.rating})`.as("avgRating"),
          reviewsCount: sql<number>`count(${review.id})`.as("reviewsCount"),
        })
        .from(review)
        .where(and(eq(review.movieId, id), eq(review.isPublic, true)));

      return {
        ...row,
        poster_url: tmdbImg.poster(row.posterPath),
        backdrop_url: tmdbImg.backdrop(row.backdropPath, "original"),
        community: {
          averageRating: stats[0]?.avgRating ?? null,
          reviewsCount: stats[0]?.reviewsCount ?? 0,
        },
      };
    },
    { params: t.Object({ id: t.String() }) },
  )
  .get(
    "/:id/reviews",
    async ({ params }) => {
      const id = Number(params.id);
      const rows = await db
        .select()
        .from(review)
        .where(and(eq(review.movieId, id), eq(review.isPublic, true)))
        .orderBy(desc(review.likesCount), desc(review.publishedAt))
        .limit(20);
      return rows;
    },
    { params: t.Object({ id: t.String() }) },
  )
  // Bulk fetch — used by profile favorites, list covers, etc. Pulls only
  // what we have locally; if a movie isn't cached, the caller can fall
  // back to /movies/:id which fetches on demand.
  .post(
    "/batch",
    async ({ body }) => {
      if (!body.ids.length) return [];
      const rows = await db
        .select({
          tmdbId: movie.tmdbId,
          title: movie.title,
          posterPath: movie.posterPath,
          year: movie.year,
        })
        .from(movie)
        .where(inArray(movie.tmdbId, body.ids));
      return rows;
    },
    { body: t.Object({ ids: t.Array(t.Number()) }) },
  );
