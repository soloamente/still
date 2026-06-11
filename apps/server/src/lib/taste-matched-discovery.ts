import { db, log, movie } from "@still/db";
import { and, desc, eq, isNull } from "drizzle-orm";

import { fetchOverlapDiarySlices } from "./fetch-overlap-diary-slices";
import { buildOverlapDiaryMap } from "./sense-taste-overlap";
import {
	fetchDismissedMoviesWithMetadata,
	fetchDismissedMovieTmdbIds,
} from "./taste-dismissed-movie-store";
import { resolveTasteNeighbors } from "./taste-neighbor-discovery";
import {
	applyRepeatGenreDownweight,
	buildDismissNegativeProfile,
	buildWeightedTasteProfile,
	genrePhraseFromWeights,
	scoreSoloCandidate,
	type TasteProfileSlice,
} from "./taste-profile";
import {
	applyDismissSimilarityPenalty,
	type DismissMetadata,
	mmrSelectCandidates,
	normalizeScores,
} from "./taste-scoring-math";
import { fetchSocialCandidates } from "./taste-social-candidates";
import { fetchStratifiedCandidates } from "./taste-stratified-candidates";

/** Minimum diary rows before taste-matched rail replaces cold-start (ST.4). */
export const TASTE_MATCH_MIN_LOGS = 10;

/** Success criteria: at least this many unseen titles in the rail. */
export const TASTE_MATCH_MIN_RESULTS = 6;

/** Enough titles for wide taste rails (`auto-fill` grid on `/home` Movies). */
export const TASTE_MATCH_TARGET_RESULTS = 24;

/** Platform popularity baseline for niche calibration when catalogue sample unavailable. */
const PLATFORM_MEDIAN_POPULARITY = 30;

const SOCIAL_BLEND_MIN_CANDIDATES = 5;
const SOCIAL_BLEND_SOLO_WEIGHT = 0.6;
const SOCIAL_BLEND_SOCIAL_WEIGHT = 0.4;
const MMR_LAMBDA = 0.35;

export type TasteMatchMovie = {
	tmdbId: number;
	title: string;
	posterPath: string | null;
	year: number | null;
};

export type TasteMatchedDiscoveryPayload = {
	coldStart: boolean;
	/** Short phrase for rail title, e.g. "drama and thriller". */
	genrePhrase: string | null;
	movies: TasteMatchMovie[];
};

export type TasteMatchServeMeta = {
	socialCount: number;
	soloCount: number;
	neighborCount: number;
	nicheBoostApplied: boolean;
	dismissCount: number;
};

export type TasteMatchedDiscoveryResult = {
	payload: TasteMatchedDiscoveryPayload;
	meta: TasteMatchServeMeta;
};

export type ScoredTasteMatchCandidate = {
	row: TasteMatchMovie;
	score: number;
	genreIds: number[];
	year: number | null;
};

type ScoreTasteMatchResult = {
	coldStart: boolean;
	genrePhrase: string | null;
	scored: ScoredTasteMatchCandidate[];
	meta: TasteMatchServeMeta;
};

type CandidateEntry = {
	tmdbId: number;
	row: TasteMatchMovie;
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

function topGenreIdsFromProfile(
	genreWeights: Map<number, number>,
	limit: number,
): number[] {
	return [...genreWeights.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, limit)
		.map(([id]) => id);
}

/**
 * Pure merge path — solo/social blend, dismiss layer 1, for unit tests and orchestrator.
 */
export function mergeBlendAndPenalizeCandidates(input: {
	candidates: CandidateEntry[];
	soloScores: Map<number, number>;
	socialScores: Map<number, number>;
	dismissMetadata: DismissMetadata[];
}): ScoredTasteMatchCandidate[] {
	const soloNorm = normalizeScores(
		[...input.soloScores.entries()].map(([key, score]) => ({ key, score })),
	);
	const socialNorm = normalizeScores(
		[...input.socialScores.entries()].map(([key, score]) => ({ key, score })),
	);

	const useSocialBlend =
		[...input.socialScores.values()].filter((score) => score > 0).length >=
		SOCIAL_BLEND_MIN_CANDIDATES;

	const scored: ScoredTasteMatchCandidate[] = [];

	for (const candidate of input.candidates) {
		const solo = soloNorm.get(candidate.tmdbId) ?? 0;
		const social = socialNorm.get(candidate.tmdbId) ?? 0;
		const blended = useSocialBlend
			? solo * SOCIAL_BLEND_SOLO_WEIGHT + social * SOCIAL_BLEND_SOCIAL_WEIGHT
			: solo;

		const finalScore = applyDismissSimilarityPenalty(
			blended,
			{
				genreIds: candidate.genreIds,
				year: candidate.year,
				originalLanguage: candidate.originalLanguage,
			},
			input.dismissMetadata,
		);

		if (finalScore <= 0) continue;

		scored.push({
			row: candidate.row,
			score: finalScore,
			genreIds: candidate.genreIds,
			year: candidate.year,
		});
	}

	return scored.sort((a, b) => b.score - a.score);
}

/**
 * Score unseen catalogue candidates for a patron — excludes logged and dismissed titles.
 * Returns the full ranked pool (pre-MMR) for dismiss replacement picks.
 */
export async function scoreTasteMatchCandidatesForUser(
	userId: string,
): Promise<ScoreTasteMatchResult> {
	const rows = await db
		.select({
			log,
			movie,
		})
		.from(log)
		.leftJoin(movie, eq(log.movieId, movie.tmdbId))
		.where(and(eq(log.userId, userId), isNull(log.removedAt)))
		.orderBy(desc(log.watchedAt))
		.limit(400);

	const movieRows = rows.filter((row) => row.log.movieId != null);
	if (movieRows.length < TASTE_MATCH_MIN_LOGS) {
		return {
			coldStart: true,
			genrePhrase: null,
			scored: [],
			meta: {
				socialCount: 0,
				soloCount: 0,
				neighborCount: 0,
				nicheBoostApplied: false,
				dismissCount: 0,
			},
		};
	}

	const total = movieRows.length;
	const slices: TasteProfileSlice[] = movieRows.map((row, index) => ({
		genreIds: (row.movie?.genreIds as number[] | undefined) ?? [],
		rating: row.log.rating,
		year: row.movie?.year ?? null,
		originalLanguage: row.movie?.originalLanguage ?? null,
		popularity: row.movie?.popularity ?? null,
		index,
		total,
		movieTmdbId: row.log.movieId ?? undefined,
	}));

	const profile = buildWeightedTasteProfile(slices);
	const genrePhrase = genrePhraseFromWeights(profile);
	const dismissedIds = await fetchDismissedMovieTmdbIds(userId);
	const excludeIds = [...new Set([...profile.loggedMovieIds, ...dismissedIds])];
	const topGenreIds = topGenreIdsFromProfile(profile.genreWeights, 3);

	const nicheBoost = profile.medianPopularity < PLATFORM_MEDIAN_POPULARITY;
	const viewerPopularityP75 = percentile75(profile.popularitySamples);

	let stratifiedCandidates: Awaited<
		ReturnType<typeof fetchStratifiedCandidates>
	> = [];
	let dismissedMetadata: Awaited<
		ReturnType<typeof fetchDismissedMoviesWithMetadata>
	> = [];
	let socialCandidates = new Map<
		number,
		Awaited<ReturnType<typeof fetchSocialCandidates>> extends Map<
			number,
			infer V
		>
			? V
			: never
	>();

	let neighborCount = 0;

	try {
		const viewerSlices = await fetchOverlapDiarySlices(userId);
		const viewerMap = buildOverlapDiaryMap(viewerSlices);

		const [stratified, dismissed, neighbors] = await Promise.all([
			fetchStratifiedCandidates({ topGenreIds, excludeTmdbIds: excludeIds }),
			fetchDismissedMoviesWithMetadata(userId, 50),
			resolveTasteNeighbors({
				viewerId: userId,
				viewerMap,
				minSharedTitles: 3,
				minCompatibility: 40,
				limit: 20,
			}),
		]);

		stratifiedCandidates = stratified;
		dismissedMetadata = dismissed;
		neighborCount = neighbors.length;
		socialCandidates = await fetchSocialCandidates({
			viewerId: userId,
			neighbors,
			excludeTmdbIds: excludeIds,
		});
	} catch (err) {
		console.error("[taste-match] neighbor/social fetch failed; solo-only", {
			userId,
			err,
		});
		const [stratified, dismissed] = await Promise.all([
			fetchStratifiedCandidates({ topGenreIds, excludeTmdbIds: excludeIds }),
			fetchDismissedMoviesWithMetadata(userId, 50),
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

	const candidateMap = new Map<number, CandidateEntry>();

	for (const row of stratifiedCandidates) {
		candidateMap.set(row.tmdbId, {
			tmdbId: row.tmdbId,
			row: {
				tmdbId: row.tmdbId,
				title: row.title,
				posterPath: row.posterPath,
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

	return {
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
	};
}

function payloadFromScoredResult(
	result: ScoreTasteMatchResult,
): TasteMatchedDiscoveryPayload {
	if (result.coldStart) {
		return { coldStart: true, genrePhrase: null, movies: [] };
	}

	const mmrPool = result.scored.map((entry) => ({
		id: entry.row.tmdbId,
		score: entry.score,
		genreIds: entry.genreIds,
		year: entry.year,
	}));

	const selected = mmrSelectCandidates(mmrPool, {
		limit: TASTE_MATCH_TARGET_RESULTS,
		lambda: MMR_LAMBDA,
	});

	const rowById = new Map(
		result.scored.map((entry) => [entry.row.tmdbId, entry.row]),
	);
	const movies = selected
		.map((entry) => rowById.get(entry.id))
		.filter((row): row is TasteMatchMovie => row != null);

	if (movies.length < TASTE_MATCH_MIN_RESULTS) {
		return { coldStart: true, genrePhrase: null, movies: [] };
	}

	return {
		coldStart: false,
		genrePhrase: result.genrePhrase,
		movies,
	};
}

/** Full discovery payload plus serve metadata for analytics. */
export async function buildTasteMatchedDiscoveryWithMeta(
	userId: string,
): Promise<TasteMatchedDiscoveryResult> {
	const result = await scoreTasteMatchCandidatesForUser(userId);
	return {
		payload: payloadFromScoredResult(result),
		meta: result.meta,
	};
}

/**
 * Social-augmented taste-matched movie picks — stratified pool, neighbor signal,
 * MMR diversity, dismiss-aware scoring.
 */
export async function buildTasteMatchedDiscovery(
	userId: string,
): Promise<TasteMatchedDiscoveryPayload> {
	const { payload } = await buildTasteMatchedDiscoveryWithMeta(userId);
	return payload;
}
