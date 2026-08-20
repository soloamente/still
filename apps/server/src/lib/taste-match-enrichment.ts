import { db, movie } from "@still/db";
import { env } from "@still/env/server";
import { inArray, sql } from "drizzle-orm";

import { fetchCachedListingCommunityStats } from "./listing-community-stats-cache";
import type { TasteMatchMovie } from "./taste-matched-discovery";
import { tmdbApi } from "./tmdb";
import {
	pickTitleLogoFromTmdbJson,
	pickTitleLogoPath,
	type TmdbTitleLogoRow,
} from "./tmdb-title-logo";
import {
	pickTrailerFromTmdbJson,
	pickTrailerFromVideoResults,
} from "./tmdb-trailer-pick";
import { traceTiming } from "./trace-timing";

/** Poster-rail titles that can become spotlight — enrich logos/trailers for each. */
const TASTE_HERO_ENRICH_LIMIT = 12;

/**
 * Server-side projection of the only three paths this module reads out of the
 * verbatim `tmdb_json` payload. Selecting the whole column cost ~300ms for 12
 * rows (vs 31ms for 24 rows without it) because it also carries credits,
 * recommendations, release dates, and every poster/backdrop variant.
 *
 * Shape is preserved so `pickTrailerFromTmdbJson` / `pickTitleLogoFromTmdbJson` /
 * `pickFestivalIconFromTmdbJson` keep working unchanged.
 */
const HERO_TMDB_JSON_PROJECTION = sql<Record<string, unknown> | null>`
	jsonb_build_object(
		'videos', ${movie.tmdbJson} -> 'videos',
		'images', jsonb_build_object('logos', ${movie.tmdbJson} -> 'images' -> 'logos'),
		'keywords', ${movie.tmdbJson} -> 'keywords'
	)
`;

/** Lightweight festival mark for the home spotlight — keyword names only. */
function pickFestivalIconFromTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): string | null {
	const keywords = (
		tmdbJson?.keywords as { keywords?: { name: string }[] } | undefined
	)?.keywords;
	if (!keywords?.length) return null;
	const blob = keywords.map((row) => row.name.toLowerCase()).join(" ");
	if (/tiff|toronto international/i.test(blob)) return "tiff";
	if (/cannes|palme d/i.test(blob)) return "cannes";
	if (/venice|mostra/i.test(blob)) return "venice";
	if (/sundance/i.test(blob)) return "sundance";
	if (/telluride/i.test(blob)) return "telluride";
	if (/oscar|academy award/i.test(blob)) return "oscars";
	return null;
}

async function enrichTasteMatchMovieRow(
	entry: TasteMatchMovie,
	cached:
		| {
				backdropPath: string | null;
				tmdbJson: unknown;
		  }
		| undefined,
	options: { includeCommunity: boolean },
): Promise<TasteMatchMovie> {
	const backdropPath = cached?.backdropPath ?? entry.backdropPath ?? null;
	const tmdbJson = cached?.tmdbJson as
		| Record<string, unknown>
		| null
		| undefined;

	let trailer = pickTrailerFromTmdbJson(tmdbJson);
	if (!trailer && env.TMDB_API_KEY) {
		try {
			const videos = await tmdbApi.movieVideos(entry.tmdbId);
			trailer = pickTrailerFromVideoResults(videos?.results);
		} catch {
			// Best-effort — hero still plays the still backdrop.
		}
	}

	let logoPath = pickTitleLogoFromTmdbJson(tmdbJson);
	if (!logoPath && env.TMDB_API_KEY) {
		try {
			const images = await tmdbApi.movieImages(entry.tmdbId);
			logoPath = pickTitleLogoPath(
				(images as { logos?: TmdbTitleLogoRow[] } | null | undefined)?.logos,
			);
		} catch {
			// Best-effort — hero falls back to the text title.
		}
	}

	const community = options.includeCommunity
		? await fetchCachedListingCommunityStats({ movieId: entry.tmdbId })
		: null;

	return {
		...entry,
		backdropPath,
		logoPath,
		communityAverage:
			community?.averageRating ?? entry.communityAverage ?? null,
		communityRatingsCount:
			community?.ratingsCount ?? entry.communityRatingsCount,
		trailerKey: trailer?.key ?? null,
		trailerSite: trailer?.site ?? null,
		festivalIcon: options.includeCommunity
			? pickFestivalIconFromTmdbJson(tmdbJson)
			: (entry.festivalIcon ?? null),
	};
}

/**
 * Attach hero fields (backdrop, community score, trailer, festival mark) after MMR
 * selection so `/api/taste/for-you` can drive the home spotlight without N+1 on
 * the scoring path.
 */
export async function enrichTasteMatchMovies(
	movies: TasteMatchMovie[],
): Promise<TasteMatchMovie[]> {
	if (movies.length === 0) return movies;

	const ids = movies.map((row) => row.tmdbId);
	/**
	 * `tmdb_json` is the verbatim TMDb payload, so it is fetched only for the hero
	 * slice that actually reads it — the rail carries 24 titles but only the first
	 * `TASTE_HERO_ENRICH_LIMIT` can become spotlight. The rest need a backdrop.
	 */
	const heroIds = ids.slice(0, TASTE_HERO_ENRICH_LIMIT);
	const [backdropRows, heroRows] = await Promise.all([
		traceTiming("taste", "enrich backdrops", () =>
			db
				.select({
					tmdbId: movie.tmdbId,
					backdropPath: movie.backdropPath,
				})
				.from(movie)
				.where(inArray(movie.tmdbId, ids)),
		),
		heroIds.length > 0
			? traceTiming("taste", "enrich heroJson", () =>
					db
						.select({
							tmdbId: movie.tmdbId,
							tmdbJson: HERO_TMDB_JSON_PROJECTION,
						})
						.from(movie)
						.where(inArray(movie.tmdbId, heroIds)),
				)
			: Promise.resolve([]),
	]);
	const backdropById = new Map(
		backdropRows.map((row) => [row.tmdbId, row.backdropPath]),
	);
	const heroJsonById = new Map(
		heroRows.map((row) => [row.tmdbId, row.tmdbJson]),
	);

	return traceTiming("taste", "enrich rows", () =>
		Promise.all(
			movies.map(async (entry, index) => {
				const backdropPath =
					backdropById.get(entry.tmdbId) ?? entry.backdropPath ?? null;

				if (index >= TASTE_HERO_ENRICH_LIMIT) {
					return { ...entry, backdropPath };
				}

				return enrichTasteMatchMovieRow(
					entry,
					{ backdropPath, tmdbJson: heroJsonById.get(entry.tmdbId) ?? null },
					{ includeCommunity: index === 0 },
				);
			}),
		),
	);
}
