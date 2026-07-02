import { db, movie } from "@still/db";
import { env } from "@still/env/server";
import { eq } from "drizzle-orm";

import { tmdbApi } from "./tmdb";
import {
	pickTitleLogoFromTmdbJson,
	pickTitleLogoPath,
	type TmdbTitleLogoRow,
} from "./tmdb-title-logo";

/**
 * Resolve a TMDb title logo path for hero lockups — cached `tmdbJson` first,
 * then a dedicated `/movie/{id}/images` fetch when logos are missing.
 */
export async function resolveMovieTitleLogoPath(
	tmdbId: number,
): Promise<string | null> {
	const [row] = await db
		.select({ tmdbJson: movie.tmdbJson })
		.from(movie)
		.where(eq(movie.tmdbId, tmdbId))
		.limit(1);

	let logoPath = pickTitleLogoFromTmdbJson(
		row?.tmdbJson as Record<string, unknown> | null | undefined,
	);

	if (!logoPath && env.TMDB_API_KEY) {
		try {
			const images = await tmdbApi.movieImages(tmdbId);
			logoPath = pickTitleLogoPath(
				(images as { logos?: TmdbTitleLogoRow[] } | null | undefined)?.logos,
			);
		} catch {
			// Best-effort — UI falls back to the text title.
		}
	}

	return logoPath;
}
