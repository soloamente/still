/**
 * TV For you — scores distinct shows (not raw log rows) with the movie blend,
 * then stamps each survivor `mediaKind: "tv"`.
 */

import { db, log, tasteDismissedTv, tv } from "@still/db";
import { env } from "@still/env/server";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import { fetchOverlapDiarySlices } from "./fetch-overlap-diary-slices";
import { fetchCachedListingCommunityStats } from "./listing-community-stats-cache";
import { buildOverlapDiaryMap } from "./sense-taste-overlap";
import { fetchDismissedTvTmdbIds } from "./taste-dismissed-tv";
import {
	mergeBlendAndPenalizeCandidates,
	type TasteMatchedDiscoveryPayload,
	type TasteMatchMovie,
	topGenreIdsFromProfile,
	toTasteMatchedDiscoveryPayload,
} from "./taste-matched-discovery";
import { resolveTasteNeighbors } from "./taste-neighbor-discovery";
import {
	applyRepeatGenreDownweight,
	buildDismissNegativeProfile,
	buildWeightedTasteProfile,
	genrePhraseFromWeights,
	scoreSoloCandidate,
	type TasteProfileSlice,
} from "./taste-profile";
import type { DismissMetadata } from "./taste-scoring-math";
import { fetchSocialTvCandidates } from "./taste-social-candidates-tv";
import { fetchStratifiedTvCandidates } from "./taste-stratified-candidates-tv";
import {
	distinctTvShowIds,
	newestTvLogPerShow,
	tvTasteIsColdStart,
} from "./taste-tv-shows";
import {
	buildTasteMatchExcludeIds,
	fetchWatchlistTvTmdbIds,
} from "./taste-watchlist-exclusion";
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

/** Platform popularity baseline for niche calibration when catalogue sample unavailable. */
const PLATFORM_MEDIAN_POPULARITY = 30;

/** Poster-rail titles that can become spotlight — enrich logos/trailers for each. */
const TV_TASTE_HERO_ENRICH_LIMIT = 12;

/**
 * Server-side projection of the only three paths this module reads out of
 * `tv.tmdb_json`. Selecting the whole column drags credits and seasons.
 */
const TV_HERO_TMDB_JSON_PROJECTION = sql<Record<string, unknown> | null>`
	jsonb_build_object(
		'videos', ${tv.tmdbJson} -> 'videos',
		'images', jsonb_build_object('logos', ${tv.tmdbJson} -> 'images' -> 'logos'),
		'keywords', ${tv.tmdbJson} -> 'keywords'
	)
`;

type TvCandidateEntry = {
	tmdbId: number;
	row: TasteMatchMovie;
	genreIds: number[];
	year: number | null;
	originalLanguage: string | null;
	popularity: number | null;
};

type DismissedTvMetadata = {
	genreIds: number[];
	year: number | null;
	originalLanguage: string | null;
	popularity: number | null;
};

function percentile75(values: number[]): number {
	if (values.length === 0) return PLATFORM_MEDIAN_POPULARITY;
	const sorted = [...values].sort((a, b) => a - b);
	const idx = Math.floor(sorted.length * 0.75);
	return sorted[Math.min(idx, sorted.length - 1)] ?? PLATFORM_MEDIAN_POPULARITY;
}

/**
 * Cold-start payloads stay untouched. Every other title is a TV show.
 */
export function stampTvTastePayload(
	payload: TasteMatchedDiscoveryPayload,
): TasteMatchedDiscoveryPayload {
	if (payload.coldStart) return payload;
	return {
		...payload,
		movies: payload.movies.map((movie) => ({
			...movie,
			mediaKind: "tv" as const,
		})),
	};
}

/** Last N TV dismissals with catalogue metadata for negative scoring. */
async function fetchDismissedTvWithMetadata(
	userId: string,
	limit = 50,
): Promise<DismissedTvMetadata[]> {
	const rows = await db
		.select({
			genreIds: tv.genreIds,
			year: tv.year,
			originalLanguage: tv.originalLanguage,
			popularity: tv.popularity,
		})
		.from(tasteDismissedTv)
		.leftJoin(tv, eq(tasteDismissedTv.tvTmdbId, tv.tmdbId))
		.where(eq(tasteDismissedTv.userId, userId))
		.orderBy(desc(tasteDismissedTv.dismissedAt))
		.limit(limit);

	return rows.map((row) => ({
		genreIds: row.genreIds ?? [],
		year: row.year,
		originalLanguage: row.originalLanguage,
		popularity: row.popularity,
	}));
}

/**
 * Series keywords live on `keywords.results`; films use `keywords.keywords`.
 * Read both so the hero festival mark still resolves from the projection.
 */
function pickFestivalIconFromTvJson(
	tmdbJson: Record<string, unknown> | null | undefined,
): string | null {
	const keywords = tmdbJson?.keywords as
		| { keywords?: { name: string }[]; results?: { name: string }[] }
		| undefined;
	const rows = keywords?.keywords ?? keywords?.results;
	if (!rows?.length) return null;
	const blob = rows.map((row) => row.name.toLowerCase()).join(" ");
	if (/tiff|toronto international/i.test(blob)) return "tiff";
	if (/cannes|palme d/i.test(blob)) return "cannes";
	if (/venice|mostra/i.test(blob)) return "venice";
	if (/sundance/i.test(blob)) return "sundance";
	if (/telluride/i.test(blob)) return "telluride";
	if (/oscar|academy award/i.test(blob)) return "oscars";
	return null;
}

async function enrichTvTasteMatchRow(
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
			const videos = await tmdbApi.tvVideos(entry.tmdbId);
			trailer = pickTrailerFromVideoResults(videos?.results);
		} catch {
			// Best-effort — hero still plays the still backdrop.
		}
	}

	let logoPath = pickTitleLogoFromTmdbJson(tmdbJson);
	if (!logoPath && env.TMDB_API_KEY) {
		try {
			const images = await tmdbApi.tvImages(entry.tmdbId);
			logoPath = pickTitleLogoPath(
				(images as { logos?: TmdbTitleLogoRow[] } | null | undefined)?.logos,
			);
		} catch {
			// Best-effort — hero falls back to the text title.
		}
	}

	const community = options.includeCommunity
		? await fetchCachedListingCommunityStats({ tvId: entry.tmdbId })
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
			? pickFestivalIconFromTvJson(tmdbJson)
			: (entry.festivalIcon ?? null),
	};
}

/**
 * Attach hero fields after MMR so only the chosen shows read `tmdb_json` paths.
 */
async function enrichTvTasteMatchShows(
	movies: TasteMatchMovie[],
): Promise<TasteMatchMovie[]> {
	if (movies.length === 0) return movies;

	const ids = movies.map((row) => row.tmdbId);
	const heroIds = ids.slice(0, TV_TASTE_HERO_ENRICH_LIMIT);
	const [backdropRows, heroRows] = await Promise.all([
		db
			.select({
				tmdbId: tv.tmdbId,
				backdropPath: tv.backdropPath,
			})
			.from(tv)
			.where(inArray(tv.tmdbId, ids)),
		heroIds.length > 0
			? db
					.select({
						tmdbId: tv.tmdbId,
						tmdbJson: TV_HERO_TMDB_JSON_PROJECTION,
					})
					.from(tv)
					.where(inArray(tv.tmdbId, heroIds))
			: Promise.resolve([]),
	]);
	const backdropById = new Map(
		backdropRows.map((row) => [row.tmdbId, row.backdropPath]),
	);
	const heroJsonById = new Map(
		heroRows.map((row) => [row.tmdbId, row.tmdbJson]),
	);

	return Promise.all(
		movies.map(async (entry, index) => {
			const backdropPath =
				backdropById.get(entry.tmdbId) ?? entry.backdropPath ?? null;

			if (index >= TV_TASTE_HERO_ENRICH_LIMIT) {
				return { ...entry, backdropPath };
			}

			return enrichTvTasteMatchRow(
				entry,
				{ backdropPath, tmdbJson: heroJsonById.get(entry.tmdbId) ?? null },
				{ includeCommunity: index === 0 },
			);
		}),
	);
}

/**
 * Score a TV For you payload from the viewer's distinct shows.
 * Omitted `media` on `/api/taste/for-you` stays on the movie scorer.
 */
export async function buildTasteMatchedDiscoveryForTv(
	userId: string,
): Promise<TasteMatchedDiscoveryPayload> {
	/**
	 * Last 400 non-removed TV logs, scalars only. `newestTvLogPerShow` collapses
	 * season and episode rows so cold start is 10 shows, not 10 log rows.
	 */
	const rows = await traceTiming("taste-tv", "viewerShowLogs", () =>
		db
			.select({
				rating: log.rating,
				tvId: log.tvId,
				watchedAt: log.watchedAt,
				genreIds: tv.genreIds,
				year: tv.year,
				originalLanguage: tv.originalLanguage,
				popularity: tv.popularity,
			})
			.from(log)
			.innerJoin(tv, eq(tv.tmdbId, log.tvId))
			.where(
				and(eq(log.userId, userId), isNull(log.removedAt), isNotNull(log.tvId)),
			)
			.orderBy(desc(log.watchedAt))
			.limit(400),
	);

	const shows = newestTvLogPerShow(rows).sort(
		(a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
	);
	if (tvTasteIsColdStart(distinctTvShowIds(shows).length)) {
		return { coldStart: true, genrePhrase: null, movies: [] };
	}

	const total = shows.length;
	const slices: TasteProfileSlice[] = shows.map((row, index) => ({
		genreIds: row.genreIds ?? [],
		rating: row.rating,
		year: row.year ?? null,
		originalLanguage: row.originalLanguage ?? null,
		popularity: row.popularity ?? null,
		index,
		total,
		// Id slot on the shared profile type — these are show ids, not movies.
		movieTmdbId: row.tvId ?? undefined,
	}));

	const profile = buildWeightedTasteProfile(slices);
	const genrePhrase = genrePhraseFromWeights(profile);
	const [dismissedIds, watchlistTvIds] = await Promise.all([
		fetchDismissedTvTmdbIds(userId),
		fetchWatchlistTvTmdbIds(userId),
	]);
	const excludeIds = buildTasteMatchExcludeIds({
		loggedMovieIds: distinctTvShowIds(shows),
		dismissedIds,
		watchlistMovieIds: watchlistTvIds,
	});
	const topGenres = topGenreIdsFromProfile(profile.genreWeights, 3);

	const nicheBoost = profile.medianPopularity < PLATFORM_MEDIAN_POPULARITY;
	const viewerPopularityP75 = percentile75(profile.popularitySamples);

	let stratifiedCandidates: Awaited<
		ReturnType<typeof fetchStratifiedTvCandidates>
	> = [];
	let dismissedMetadata: DismissedTvMetadata[] = [];
	let socialCandidates = new Map<
		number,
		Awaited<ReturnType<typeof fetchSocialTvCandidates>> extends Map<
			number,
			infer V
		>
			? V
			: never
	>();
	let neighborCount = 0;

	try {
		const viewerSlices = await traceTiming(
			"taste-tv",
			"overlapDiarySlices",
			() => fetchOverlapDiarySlices(userId),
		);
		const viewerMap = buildOverlapDiaryMap(viewerSlices);

		const [stratified, dismissed, neighbors] = await Promise.all([
			traceTiming("taste-tv", "stratifiedCandidates", () =>
				fetchStratifiedTvCandidates({
					topGenreIds: topGenres,
					excludeTmdbIds: excludeIds,
				}),
			),
			traceTiming("taste-tv", "dismissedShows", () =>
				fetchDismissedTvWithMetadata(userId, 50),
			),
			traceTiming("taste-tv", "resolveTasteNeighbors", () =>
				resolveTasteNeighbors({
					viewerId: userId,
					viewerMap,
					minSharedTitles: 3,
					minCompatibility: 40,
					limit: 20,
				}),
			),
		]);

		stratifiedCandidates = stratified;
		dismissedMetadata = dismissed;
		neighborCount = neighbors.length;
		socialCandidates = await traceTiming("taste-tv", "socialCandidates", () =>
			fetchSocialTvCandidates({
				viewerId: userId,
				neighbors,
				excludeTmdbIds: excludeIds,
			}),
		);
	} catch (err) {
		console.error("[taste-match-tv] neighbor/social fetch failed; solo-only", {
			userId,
			err,
		});
		const [stratified, dismissed] = await Promise.all([
			fetchStratifiedTvCandidates({
				topGenreIds: topGenres,
				excludeTmdbIds: excludeIds,
			}),
			fetchDismissedTvWithMetadata(userId, 50),
		]);
		stratifiedCandidates = stratified;
		dismissedMetadata = dismissed;
	}

	const negativeProfile = buildDismissNegativeProfile(dismissedMetadata);
	const dismissMetadata: DismissMetadata[] = dismissedMetadata.map((row) => ({
		genreIds: row.genreIds,
		year: row.year,
		originalLanguage: row.originalLanguage,
	}));

	const candidateMap = new Map<number, TvCandidateEntry>();

	for (const row of stratifiedCandidates) {
		candidateMap.set(row.tmdbId, {
			tmdbId: row.tmdbId,
			row: {
				tmdbId: row.tmdbId,
				title: row.title,
				posterPath: row.posterPath,
				backdropPath: row.backdropPath,
				year: row.year,
			},
			genreIds: row.genreIds,
			year: row.year,
			originalLanguage: row.originalLanguage,
			popularity: row.popularity,
		});
	}

	for (const social of socialCandidates.values()) {
		if (candidateMap.has(social.tmdbId)) continue;
		candidateMap.set(social.tmdbId, {
			tmdbId: social.tmdbId,
			row: {
				tmdbId: social.tmdbId,
				title: social.title,
				posterPath: social.posterPath,
				year: social.year,
			},
			genreIds: social.genreIds,
			year: social.year,
			originalLanguage: social.originalLanguage,
			popularity: social.popularity,
		});
	}

	const soloScores = new Map<number, number>();
	const socialScores = new Map<number, number>();

	for (const candidate of candidateMap.values()) {
		const metadata = {
			genreIds: candidate.genreIds,
			year: candidate.year,
			originalLanguage: candidate.originalLanguage,
			popularity: candidate.popularity,
		};

		let soloRaw = scoreSoloCandidate(metadata, profile, {
			nicheBoost,
			viewerPopularityP75,
		});
		soloRaw = applyRepeatGenreDownweight(
			soloRaw,
			metadata,
			profile,
			negativeProfile,
		);
		if (soloRaw > 0) soloScores.set(candidate.tmdbId, soloRaw);

		const social = socialCandidates.get(candidate.tmdbId);
		if (social != null && social.socialScore > 0) {
			socialScores.set(candidate.tmdbId, social.socialScore);
		}
	}

	const scored = mergeBlendAndPenalizeCandidates({
		candidates: [...candidateMap.values()],
		soloScores,
		socialScores,
		dismissMetadata,
	});

	let payload = toTasteMatchedDiscoveryPayload({
		coldStart: false,
		genrePhrase,
		scored,
		meta: {
			socialCount: [...socialScores.keys()].length,
			soloCount: [...soloScores.keys()].length,
			neighborCount,
			nicheBoostApplied: nicheBoost,
			dismissCount: dismissedMetadata.length,
		},
	});

	if (!payload.coldStart && payload.movies.length > 0) {
		payload = {
			...payload,
			movies: await traceTiming("taste-tv", "enrichShows", () =>
				enrichTvTasteMatchShows(payload.movies),
			),
		};
	}

	const stamped = stampTvTastePayload(payload);
	return {
		...stamped,
		consumedTmdbIds: excludeIds,
	};
}
