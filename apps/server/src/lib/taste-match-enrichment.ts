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

type TmdbVideoRow = {
	key: string;
	site: string;
	type: string;
};

/** First official trailer/teaser on YouTube or Vimeo from cached TMDb JSON. */
function pickTrailerFromTmdbJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): { key: string; site: string } | null {
	const results = (tmdbJson?.videos as { results?: TmdbVideoRow[] } | undefined)
		?.results;
	if (!results?.length) return null;

	const trailer =
		results.find(
			(row) =>
				row.type === "Trailer" &&
				(row.site === "YouTube" || row.site === "Vimeo"),
		) ?? results.find((row) => row.site === "YouTube" || row.site === "Vimeo");
	if (!trailer?.key) return null;
	return { key: trailer.key, site: trailer.site };
}

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

			// Poster stack rows only need backdrop — spotlight alone gets scores, logos, and TMDB calls.
			if (index > 0) {
				return { ...entry, backdropPath };
			}

			const tmdbJson = cached?.tmdbJson as
				| Record<string, unknown>
				| null
				| undefined;
			const trailer = pickTrailerFromTmdbJson(tmdbJson);
			let logoPath = pickTitleLogoFromTmdbJson(tmdbJson);

			// Title logos live on `/images`, not the detail append bundle — one fetch for the spotlight.
			if (!logoPath && env.TMDB_API_KEY) {
				try {
					const images = await tmdbApi.movieImages(entry.tmdbId);
					logoPath = pickTitleLogoPath(
						(images as { logos?: TmdbTitleLogoRow[] } | null | undefined)
							?.logos,
					);
				} catch {
					// Best-effort — hero falls back to the text title.
				}
			}

			const community = await fetchCachedListingCommunityStats({
				movieId: entry.tmdbId,
			});

			return {
				...entry,
				backdropPath,
				logoPath,
				communityAverage: community.averageRating,
				communityRatingsCount: community.ratingsCount,
				trailerKey: trailer?.key ?? null,
				trailerSite: trailer?.site ?? null,
				festivalIcon: pickFestivalIconFromTmdbJson(tmdbJson),
			};
		}),
	);
}
