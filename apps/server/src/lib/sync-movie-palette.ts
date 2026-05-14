import { db, movie } from "@still/db";
import { eq } from "drizzle-orm";

import { extractPosterPalette } from "./poster-palette";
import { tmdbImg } from "./tmdb";

/**
 * After caching TMDb detail, derive poster colors and persist on the `movie`
 * row for the web movie-themed shell (selection, focus, optional scroll tint).
 */
export async function syncMoviePosterPalette(tmdbId: number, posterPath: string | null) {
  const url = tmdbImg.poster(posterPath, "w342");
  const p = await extractPosterPalette(url);
  if (!p) return;
  await db
    .update(movie)
    .set({
      paletteAccent: p.accent,
      paletteMuted: p.muted,
      paletteForeground: p.foreground,
    })
    .where(eq(movie.tmdbId, tmdbId));
}
