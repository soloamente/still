/**
 * Rating-weighted taste profile and dismiss negative signal for the For you rail.
 * Pure functions — no I/O; orchestrator loads diary/dismiss rows then calls these.
 */

import {
	decadeFromYear,
	ratingAffinityWeight,
	recencyDecayByIndex,
} from "./taste-scoring-math";

/** One diary row passed into profile build (index 0 = newest in batch). */
export type TasteProfileSlice = {
	genreIds: number[];
	rating: number | null;
	year: number | null;
	originalLanguage: string | null;
	popularity: number | null;
	index: number;
	total: number;
	/** Optional — when present, title is excluded from candidate pools. */
	movieTmdbId?: number;
};

/** Positive taste signal accumulated from rated diary logs. */
export type WeightedTasteProfile = {
	genreWeights: Map<number, number>;
	decadeWeights: Map<number, number>;
	languageWeights: Map<string, number>;
	loggedMovieIds: Set<number>;
	medianPopularity: number;
	popularitySamples: number[];
};

/** Dismiss history condensed into repeat-genre counts (layer 2 penalty). */
export type DismissNegativeProfile = {
	repeatGenreCounts: Map<number, number>;
};

/** Metadata needed to score an unseen catalogue candidate solo. */
export type SoloCandidateMetadata = {
	genreIds: number[];
	year: number | null;
	originalLanguage: string | null;
	popularity: number | null;
};

/** Row shape for dismiss negative profile — movieTmdbId omitted on purpose. */
export type DismissNegativeRow = {
	genreIds: number[];
	year: number | null;
	originalLanguage: string | null;
	popularity: number | null;
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

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
	}
	return sorted[mid] ?? 0;
}

/**
 * Build rating- and recency-weighted genre/decade/language affinities from diary slices.
 * High-rated recent logs steer the profile more than low-rated older ones.
 */
export function buildWeightedTasteProfile(
	slices: TasteProfileSlice[],
): WeightedTasteProfile {
	const genreWeights = new Map<number, number>();
	const decadeWeights = new Map<number, number>();
	const languageWeights = new Map<string, number>();
	const loggedMovieIds = new Set<number>();
	const popularitySamples: number[] = [];

	for (const slice of slices) {
		const affinity =
			ratingAffinityWeight(slice.rating) *
			recencyDecayByIndex(slice.index, slice.total);

		for (const id of slice.genreIds) {
			genreWeights.set(id, (genreWeights.get(id) ?? 0) + affinity);
		}

		const decade = decadeFromYear(slice.year);
		if (decade != null) {
			decadeWeights.set(decade, (decadeWeights.get(decade) ?? 0) + affinity);
		}

		const lang = slice.originalLanguage?.trim().toLowerCase();
		if (lang) {
			languageWeights.set(lang, (languageWeights.get(lang) ?? 0) + affinity);
		}

		if (slice.movieTmdbId != null && slice.movieTmdbId > 0) {
			loggedMovieIds.add(slice.movieTmdbId);
		}

		if (slice.popularity != null && Number.isFinite(slice.popularity)) {
			popularitySamples.push(slice.popularity);
		}
	}

	return {
		genreWeights,
		decadeWeights,
		languageWeights,
		loggedMovieIds,
		medianPopularity: median(popularitySamples),
		popularitySamples,
	};
}

/**
 * Count how often each genre appears across recent dismissals.
 * Layer 2 downweight only fires when count >= 2 for a genre on the candidate.
 */
export function buildDismissNegativeProfile(
	dismissRows: DismissNegativeRow[],
): DismissNegativeProfile {
	const repeatGenreCounts = new Map<number, number>();

	for (const row of dismissRows) {
		for (const genreId of row.genreIds) {
			repeatGenreCounts.set(genreId, (repeatGenreCounts.get(genreId) ?? 0) + 1);
		}
	}

	return { repeatGenreCounts };
}

/**
 * Solo content score before social blend and dismiss layer 1.
 * Genre/decade/language weights mirror v1 multipliers; popularity capped at +4.
 */
export function scoreSoloCandidate(
	candidate: SoloCandidateMetadata,
	profile: WeightedTasteProfile,
	options: { nicheBoost: boolean; viewerPopularityP75: number },
): number {
	let score = 0;
	let genreMatchedScore = 0;

	for (const id of candidate.genreIds) {
		const w = profile.genreWeights.get(id) ?? 0;
		if (w > 0) {
			const genreContribution = w * 8;
			score += genreContribution;
			genreMatchedScore += genreContribution;
		}
	}

	const decade = decadeFromYear(candidate.year);
	if (decade != null) {
		score += (profile.decadeWeights.get(decade) ?? 0) * 6;
	}

	const lang = candidate.originalLanguage?.trim().toLowerCase();
	if (lang) {
		score += (profile.languageWeights.get(lang) ?? 0) * 4;
	}

	const pop = candidate.popularity ?? 0;
	score += Math.min(pop / 15, 4);

	// Niche patrons: boost obscure titles that still match weighted genres.
	if (
		options.nicheBoost &&
		candidate.popularity != null &&
		candidate.popularity <= options.viewerPopularityP75
	) {
		score += genreMatchedScore * 0.25;
	}

	return score;
}

/**
 * Layer 2 dismiss penalty — repeat dismissals in a genre downrank similar picks.
 * One-off dismiss does not trigger (count must be >= 2).
 */
export function applyRepeatGenreDownweight(
	soloScore: number,
	candidate: SoloCandidateMetadata,
	profile: WeightedTasteProfile,
	negative: DismissNegativeProfile,
): number {
	let penalty = 0;

	for (const genreId of candidate.genreIds) {
		const dismissCount = negative.repeatGenreCounts.get(genreId) ?? 0;
		if (dismissCount < 2) continue;

		const positiveGenreWeight = profile.genreWeights.get(genreId) ?? 0;
		penalty += Math.min(dismissCount * 3, positiveGenreWeight * 0.35);
	}

	return Math.max(0, soloScore - penalty);
}

/** Top 1–2 genre affinities for rail title copy, e.g. "drama and thriller". */
export function genrePhraseFromWeights(
	profile: WeightedTasteProfile,
): string | null {
	const ranked = [...profile.genreWeights.entries()].sort(
		(a, b) => b[1] - a[1],
	);
	const primary = ranked[0]?.[0];
	const secondary = ranked[1]?.[0];
	if (primary == null) return null;
	if (secondary != null && primary !== secondary) {
		return `${genreLabel(primary)} and ${genreLabel(secondary)}`;
	}
	return genreLabel(primary);
}
