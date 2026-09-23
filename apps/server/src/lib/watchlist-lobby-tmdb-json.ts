import { movie, tv } from "@still/db";
import { sql } from "drizzle-orm";

/**
 * Server-side projection of the only `tmdb_json` path `GET /api/watchlist`
 * reads. Selecting whole `movie` / `tv` rows pulls ~85KB of credits,
 * similar, images, and videos per title — the lobby only needs the
 * cached `watch/providers` object so `watchProvidersFromTmdbJson` still
 * works unchanged.
 */
export const WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION = sql<Record<
	string,
	unknown
> | null>`
	jsonb_build_object(
		'watch/providers',
		coalesce(
			${movie.tmdbJson} -> 'watch/providers',
			${tv.tmdbJson} -> 'watch/providers'
		)
	)
`;
