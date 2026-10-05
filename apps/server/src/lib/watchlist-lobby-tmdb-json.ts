import { movie, tv } from "@still/db";
import { type SQL, sql } from "drizzle-orm";

/**
 * Server-side projection of the only `tmdb_json` path `GET /api/watchlist`
 * reads. Selecting whole `movie` / `tv` rows pulls ~85KB of credits,
 * similar, images, and videos per title — the lobby only needs the
 * cached `watch/providers` object so `watchProvidersFromTmdbJson` still
 * works unchanged.
 *
 * Still returns every country's providers — prefer
 * `watchlistProvidersTmdbJsonForRegion` wherever one region is evaluated.
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

/**
 * Same shape as `WATCHLIST_PROVIDERS_TMDB_JSON_PROJECTION`, narrowed to one
 * country (`{ "watch/providers": { results: { [region]: … } } }`) so the
 * 500-row decision pool and the alert preview don't drag every country's
 * provider lists out of Neon. `primaryFlatrateProviderName(json, region)`
 * reads it unchanged. The region is a bound parameter — never interpolated.
 */
export function watchlistProvidersTmdbJsonForRegion(
	region: string,
): SQL<Record<string, unknown> | null> {
	const code = region.trim().toUpperCase();
	return sql<Record<string, unknown> | null>`
	jsonb_build_object(
		'watch/providers',
		jsonb_build_object(
			'results',
			jsonb_build_object(
				${code}::text,
				coalesce(
					${movie.tmdbJson} -> 'watch/providers' -> 'results' -> ${code}::text,
					${tv.tmdbJson} -> 'watch/providers' -> 'results' -> ${code}::text
				)
			)
		),
		'release_dates',
		jsonb_build_object(
			'results',
			coalesce(
				(
					SELECT jsonb_build_array(elem)
					FROM jsonb_array_elements(
						coalesce(${movie.tmdbJson} -> 'release_dates' -> 'results', '[]'::jsonb)
					) AS elem
					WHERE elem ->> 'iso_3166_1' = ${code}
					LIMIT 1
				),
				'[]'::jsonb
			)
		)
	)
`;
}

/** No region to evaluate — skip the JSON read entirely. */
export const WATCHLIST_NO_PROVIDERS_TMDB_JSON = sql<Record<
	string,
	unknown
> | null>`null::jsonb`;
