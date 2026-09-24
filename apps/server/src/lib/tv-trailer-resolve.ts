import { db, tv } from "@still/db";
import { env } from "@still/env/server";
import { eq, sql } from "drizzle-orm";

import { tmdbApi } from "./tmdb";
import {
	pickTrailerFromTmdbJson,
	pickTrailerFromVideoResults,
} from "./tmdb-trailer-pick";

/**
 * Same three-path projection the TV taste enricher uses. Do not select the
 * whole `tv.tmdb_json` column — it carries credits, seasons, and images.
 */
const TV_TMDB_JSON_PROJECTION = sql<Record<string, unknown> | null>`
	jsonb_build_object(
		'videos', ${tv.tmdbJson} -> 'videos',
		'images', jsonb_build_object('logos', ${tv.tmdbJson} -> 'images' -> 'logos'),
		'keywords', ${tv.tmdbJson} -> 'keywords'
	)
`;

/**
 * Resolve a background trailer for TV lobby heroes — projected cache first,
 * then `/tv/{id}/videos` when the cache has no trailer.
 */
export async function resolveTvTrailer(
	tmdbId: number,
): Promise<{ trailerKey: string; trailerSite: string } | null> {
	const [row] = await db
		.select({ tmdbJson: TV_TMDB_JSON_PROJECTION })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbId))
		.limit(1);

	let trailer = pickTrailerFromTmdbJson(
		row?.tmdbJson as Record<string, unknown> | null | undefined,
	);

	if (!trailer && env.TMDB_API_KEY) {
		try {
			const videos = await tmdbApi.tvVideos(tmdbId);
			trailer = pickTrailerFromVideoResults(videos?.results);
		} catch {
			// Best-effort — hero falls back to the still backdrop.
		}
	}

	if (!trailer?.key) return null;
	return { trailerKey: trailer.key, trailerSite: trailer.site };
}
