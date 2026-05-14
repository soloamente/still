import { db, movie, newsArticle, newsSource } from "@still/db";
import { eq, lt } from "drizzle-orm";

import { makeId } from "../lib/cuid";
import { syncMoviePosterPalette } from "../lib/sync-movie-palette";
import { tmdbApi, tmdbImg, type TmdbMovieSummary } from "../lib/tmdb";

const TMDB_VIRTUAL_SOURCES: { id: string; name: string; kind: "tmdb_trending" | "tmdb_upcoming" | "tmdb_now_playing" | "tmdb_popular"; fetcher: () => Promise<{ results: TmdbMovieSummary[] }> }[] = [
  { id: "tmdb_trending", name: "Trending on TMDb", kind: "tmdb_trending", fetcher: () => tmdbApi.trending("day") },
  { id: "tmdb_upcoming", name: "Upcoming Releases", kind: "tmdb_upcoming", fetcher: () => tmdbApi.upcoming(1) },
  { id: "tmdb_now_playing", name: "In Theaters Now", kind: "tmdb_now_playing", fetcher: () => tmdbApi.nowPlaying(1) },
  { id: "tmdb_popular", name: "Popular on TMDb", kind: "tmdb_popular", fetcher: () => tmdbApi.popular(1) },
];

async function ensureTmdbSources() {
  for (const src of TMDB_VIRTUAL_SOURCES) {
    await db
      .insert(newsSource)
      .values({ id: src.id, name: src.name, kind: src.kind, isActive: true })
      .onConflictDoNothing();
  }
}

/**
 * Daily: refresh "movie of the moment" lists (trending, upcoming, now
 * playing, popular) by:
 *   1. caching every returned movie into our local `movie` table
 *   2. emitting a synthetic news_article per movie under the matching
 *      virtual TMDb source so the news feed surfaces release moments.
 */
export async function syncTmdbFeeds() {
  await ensureTmdbSources();
  for (const src of TMDB_VIRTUAL_SOURCES) {
    try {
      const page = await src.fetcher();
      for (const result of page.results) {
        // Cache the movie locally (idempotent).
        await db
          .insert(movie)
          .values({
            tmdbId: result.id,
            title: result.title,
            originalTitle: result.original_title ?? null,
            overview: result.overview,
            posterPath: result.poster_path,
            backdropPath: result.backdrop_path,
            releaseDate: result.release_date ? new Date(result.release_date) : null,
            year: result.release_date ? Number(result.release_date.slice(0, 4)) : null,
            genreIds: result.genre_ids ?? [],
            originalLanguage: result.original_language ?? null,
            popularity: result.popularity ?? null,
            voteAverage: result.vote_average ?? null,
            voteCount: result.vote_count ?? null,
          })
          .onConflictDoNothing();

        // Synthetic news article for the feed.
        await db
          .insert(newsArticle)
          .values({
            id: makeId("nws"),
            sourceId: src.id,
            externalId: `${src.id}:${result.id}`,
            title: result.title,
            summary: result.overview?.slice(0, 240) ?? null,
            url: `https://www.themoviedb.org/movie/${result.id}`,
            imageUrl: tmdbImg.backdrop(result.backdrop_path) ?? tmdbImg.poster(result.poster_path),
            publishedAt: result.release_date ? new Date(result.release_date) : new Date(),
            movieIds: [result.id],
          })
          .onConflictDoNothing();
      }
      await db
        .update(newsSource)
        .set({ lastFetchedAt: new Date() })
        .where(eq(newsSource.id, src.id));
    } catch (err) {
      console.error(`[tmdb-sync] ${src.id} failed`, err);
    }
  }
}

/**
 * Weekly: refresh stale individual movie details — fetch the full detail
 * payload for any movie we haven't synced in > 30 days, but cap the work
 * at 200 movies/run so we don't blow out our TMDb rate limit.
 */
export async function refreshStaleMovies() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: movie.tmdbId })
    .from(movie)
    .where(lt(movie.lastSyncedAt, cutoff))
    .limit(200);
  for (const { id } of stale) {
    try {
      const detail = await tmdbApi.movieDetail(id);
      await db
        .update(movie)
        .set({
          title: detail.title,
          overview: detail.overview,
          posterPath: detail.poster_path,
          backdropPath: detail.backdrop_path,
          popularity: detail.popularity ?? null,
          voteAverage: detail.vote_average ?? null,
          voteCount: detail.vote_count ?? null,
          tmdbJson: detail as unknown as Record<string, unknown>,
          lastSyncedAt: new Date(),
        })
        .where(eq(movie.tmdbId, id));
      await syncMoviePosterPalette(id, detail.poster_path);
    } catch (err) {
      console.error(`[tmdb-sync] refresh ${id} failed`, err);
    }
  }
}
