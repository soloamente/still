import { db, movie } from "@still/db";
import { env } from "@still/env/server";
import { inArray } from "drizzle-orm";

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

/** Poster-rail titles that can become spotlight — enrich logos/trailers for each. */
const TASTE_HERO_ENRICH_LIMIT = 12;

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
	const rows = await db
		.select({
			tmdbId: movie.tmdbId,
			backdropPath: movie.backdropPath,
			tmdbJson: movie.tmdbJson,
		})
		.from(movie)
		.where(inArray(movie.tmdbId, ids));
	const rowById = new Map(rows.map((row) => [row.tmdbId, row]));

	return Promise.all(
		movies.map(async (entry, index) => {
			const cached = rowById.get(entry.tmdbId);
			const backdropPath = cached?.backdropPath ?? entry.backdropPath ?? null;

			if (index >= TASTE_HERO_ENRICH_LIMIT) {
				return { ...entry, backdropPath };
			}

			return enrichTasteMatchMovieRow(entry, cached, {
				includeCommunity: index === 0,
			});
		}),
	);
}
