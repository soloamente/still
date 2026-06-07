import { db, log, movie } from "@still/db";
import { and, desc, eq, isNotNull, isNull, notInArray } from "drizzle-orm";

import type { TasteSignatureLogSlice } from "./sense-taste-signature";
import { fetchDismissedMovieTmdbIds } from "./taste-dismissed-movie-store";

/** Minimum diary rows before taste-matched rail replaces cold-start (ST.4). */
export const TASTE_MATCH_MIN_LOGS = 10;

/** Success criteria: at least this many unseen titles in the rail. */
export const TASTE_MATCH_MIN_RESULTS = 6;

/** Enough titles for wide taste rails (`auto-fill` grid on `/home` Movies). */
export const TASTE_MATCH_TARGET_RESULTS = 24;

const CANDIDATE_POOL_LIMIT = 500;

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

type TasteDiscoveryLogSlice = TasteSignatureLogSlice & {
	movieId?: number;
	year?: number | null;
	originalLanguage?: string | null;
};

type TasteProfile = {
	genreWeights: Map<number, number>;
	decadeWeights: Map<number, number>;
	languageWeights: Map<string, number>;
	loggedMovieIds: Set<number>;
};

const TMDB_GENRE_NAMES: Record<number, string> = {
	28: "action",
	12: "adventure",
	16: "animation",
	35: "comedy",
	80: "crime",
	99: "documentary",
	18: "drama",
	10751: "family",
	14: "fantasy",
	36: "history",
	27: "horror",
	10402: "music",
	9648: "mystery",
	10749: "romance",
	878: "science fiction",
	10770: "TV movie",
	53: "thriller",
	10752: "war",
	37: "western",
};

function genreLabel(id: number): string {
	return TMDB_GENRE_NAMES[id] ?? "film";
}

function decadeFromYear(year: number | null | undefined): number | null {
	if (year == null || !Number.isFinite(year)) return null;
	return Math.floor(year / 10) * 10;
}

function buildTasteProfile(slices: TasteDiscoveryLogSlice[]): TasteProfile {
	const genreWeights = new Map<number, number>();
	const decadeWeights = new Map<number, number>();
	const languageWeights = new Map<string, number>();

	for (const slice of slices) {
		for (const id of slice.genreIds) {
			genreWeights.set(id, (genreWeights.get(id) ?? 0) + 1);
		}
		const decade = decadeFromYear(slice.year ?? null);
		if (decade != null) {
			decadeWeights.set(decade, (decadeWeights.get(decade) ?? 0) + 1);
		}
		const lang = slice.originalLanguage?.trim().toLowerCase();
		if (lang) {
			languageWeights.set(lang, (languageWeights.get(lang) ?? 0) + 1);
		}
	}

	return {
		genreWeights,
		decadeWeights,
		languageWeights,
		loggedMovieIds: new Set(
			slices
				.map((s) => s.movieId)
				.filter((id): id is number => typeof id === "number" && id > 0),
		),
	};
}

function genrePhraseFromWeights(weights: Map<number, number>): string | null {
	const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
	const primary = ranked[0]?.[0];
	const secondary = ranked[1]?.[0];
	if (primary == null) return null;
	if (secondary != null && primary !== secondary) {
		return `${genreLabel(primary)} and ${genreLabel(secondary)}`;
	}
	return genreLabel(primary);
}

function scoreCandidate(
	movie: {
		tmdbId: number;
		genreIds: number[];
		year: number | null;
		originalLanguage: string | null;
		popularity: number | null;
	},
	profile: TasteProfile,
): number {
	let score = 0;

	for (const id of movie.genreIds) {
		const w = profile.genreWeights.get(id) ?? 0;
		if (w > 0) score += w * 8;
	}

	const decade = decadeFromYear(movie.year);
	if (decade != null) {
		score += (profile.decadeWeights.get(decade) ?? 0) * 6;
	}

	const lang = movie.originalLanguage?.trim().toLowerCase();
	if (lang) {
		score += (profile.languageWeights.get(lang) ?? 0) * 4;
	}

	const pop = movie.popularity ?? 0;
	score += Math.min(pop / 15, 12);

	return score;
}

export type ScoredTasteMatchCandidate = {
	row: TasteMatchMovie;
	score: number;
};

/**
 * Score unseen catalogue candidates for a patron — excludes logged and dismissed titles.
 */
export async function scoreTasteMatchCandidatesForUser(
	userId: string,
): Promise<{
	coldStart: boolean;
	genrePhrase: string | null;
	scored: ScoredTasteMatchCandidate[];
}> {
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
		return { coldStart: true, genrePhrase: null, scored: [] };
	}

	const slices: TasteDiscoveryLogSlice[] = movieRows.map((row) => ({
		genreIds: (row.movie?.genreIds as number[] | undefined) ?? [],
		rating: row.log.rating,
		tmdbVoteAverage: row.movie?.voteAverage ?? null,
		title: row.movie?.title ?? null,
		movieId: row.log.movieId ?? undefined,
		year: row.movie?.year ?? null,
		originalLanguage: row.movie?.originalLanguage ?? null,
	}));

	const tasteProfile = buildTasteProfile(slices);
	const genrePhrase = genrePhraseFromWeights(tasteProfile.genreWeights);
	const loggedIds = [...tasteProfile.loggedMovieIds];
	const dismissedIds = await fetchDismissedMovieTmdbIds(userId);
	const excludeIds = [...new Set([...loggedIds, ...dismissedIds])];

	const candidateWhere =
		excludeIds.length > 0
			? and(isNotNull(movie.popularity), notInArray(movie.tmdbId, excludeIds))
			: isNotNull(movie.popularity);

	const candidates = await db
		.select({
			tmdbId: movie.tmdbId,
			title: movie.title,
			posterPath: movie.posterPath,
			year: movie.year,
			genreIds: movie.genreIds,
			originalLanguage: movie.originalLanguage,
			popularity: movie.popularity,
		})
		.from(movie)
		.where(candidateWhere)
		.orderBy(desc(movie.popularity))
		.limit(CANDIDATE_POOL_LIMIT);

	const scored = candidates
		.map((row) => ({
			row: {
				tmdbId: row.tmdbId,
				title: row.title,
				posterPath: row.posterPath,
				year: row.year,
			},
			score: scoreCandidate(
				{
					tmdbId: row.tmdbId,
					genreIds: (row.genreIds as number[]) ?? [],
					year: row.year,
					originalLanguage: row.originalLanguage,
					popularity: row.popularity,
				},
				tasteProfile,
			),
		}))
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score);

	return {
		coldStart: false,
		genrePhrase,
		scored,
	};
}

/**
 * Rule-based taste-matched movie picks (ST.4) — genre, decade, language vs diary;
 * excludes logged and dismissed titles.
 */
export async function buildTasteMatchedDiscovery(
	userId: string,
): Promise<TasteMatchedDiscoveryPayload> {
	const { coldStart, genrePhrase, scored } =
		await scoreTasteMatchCandidatesForUser(userId);

	if (coldStart) {
		return { coldStart: true, genrePhrase: null, movies: [] };
	}

	const movies = scored
		.slice(0, TASTE_MATCH_TARGET_RESULTS)
		.map(({ row }) => row);

	if (movies.length < TASTE_MATCH_MIN_RESULTS) {
		return { coldStart: true, genrePhrase: null, movies: [] };
	}

	return {
		coldStart: false,
		genrePhrase,
		movies,
	};
}
