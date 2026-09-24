import { db, tv } from "@still/db";
import { env } from "@still/env/server";
import { eq, sql } from "drizzle-orm";

import { tmdbApi } from "./tmdb";
import {
	pickTitleLogoFromTmdbJson,
	pickTitleLogoPath,
	type TmdbTitleLogoRow,
} from "./tmdb-title-logo";

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
 * Resolve a TMDb title logo path for TV hero lockups — projected cache first,
 * then `/tv/{id}/images` when logos are missing.
 */
export async function resolveTvTitleLogoPath(
	tmdbId: number,
): Promise<string | null> {
	const [row] = await db
		.select({ tmdbJson: TV_TMDB_JSON_PROJECTION })
		.from(tv)
		.where(eq(tv.tmdbId, tmdbId))
		.limit(1);

	let logoPath = pickTitleLogoFromTmdbJson(
		row?.tmdbJson as Record<string, unknown> | null | undefined,
	);

	if (!logoPath && env.TMDB_API_KEY) {
		try {
			const images = await tmdbApi.tvImages(tmdbId);
			logoPath = pickTitleLogoPath(
				(images as { logos?: TmdbTitleLogoRow[] } | null | undefined)?.logos,
			);
		} catch {
			// Best-effort — UI falls back to the text title.
		}
	}

	return logoPath;
}
