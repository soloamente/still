/**
 * Pure taste-scoring math for the For you rail (no I/O).
 * Used by profile build, dismiss penalties, pool normalization, and MMR diversity.
 */

import { storedRatingToDisplayTen } from "./sense-taste-overlap";

/** Maps stored log rating to affinity weight — high-rated titles steer taste more. */
export function ratingAffinityWeight(storedRating: number | null): number {
	if (storedRating == null) return 0.3;
	const display = storedRatingToDisplayTen(storedRating);
	if (display <= 5) return 0.5;
	if (display >= 9) return 1.4;
	if (display >= 7) return 1.0;
	// Linear ramp 5.0 → 0.5 through 7.0 → 1.0
	return 0.5 + (display - 5) * 0.25;
}

/** index 0 = newest log in the batch passed to profile builder */
export function recencyDecayByIndex(index: number, total: number): number {
	if (total <= 1) return 1;
	const t = index / (total - 1);
	// Mild bias: 1.0 at newest down to 0.6 at oldest in the batch
	return 1 - t * 0.4;
}

export function decadeFromYear(year: number | null | undefined): number | null {
	if (year == null || !Number.isFinite(year)) return null;
	return Math.floor(year / 10) * 10;
}

export function genreJaccardSimilarity(a: number[], b: number[]): number {
	const setA = new Set(a);
	const setB = new Set(b);
	if (setA.size === 0 && setB.size === 0) return 0;
	let intersection = 0;
	for (const id of setA) if (setB.has(id)) intersection += 1;
	const union = new Set([...setA, ...setB]).size;
	return union === 0 ? 0 : intersection / union;
}

export type DismissMetadata = {
	genreIds: number[];
	year: number | null;
	originalLanguage: string | null;
};

export type CandidateMetadata = DismissMetadata;

/** How closely a candidate resembles a dismissed title (genre + decade + language). */
export function dismissSimilarity(
	candidate: CandidateMetadata,
	dismissed: DismissMetadata,
): number {
	const decadeA = decadeFromYear(candidate.year);
	const decadeB = decadeFromYear(dismissed.year);
	const langA = candidate.originalLanguage?.trim().toLowerCase() ?? "";
	const langB = dismissed.originalLanguage?.trim().toLowerCase() ?? "";
	return (
		genreJaccardSimilarity(candidate.genreIds, dismissed.genreIds) * 0.7 +
		(decadeA != null && decadeA === decadeB ? 0.2 : 0) +
		(langA.length > 0 && langA === langB ? 0.1 : 0)
	);
}

/** Layer 1 dismiss penalty — capped so strong diary matches are never zeroed. */
export function applyDismissSimilarityPenalty(
	blendedScore: number,
	candidate: CandidateMetadata,
	dismissedRows: DismissMetadata[],
): number {
	if (dismissedRows.length === 0) return blendedScore;
	let maxSim = 0;
	for (const dismissed of dismissedRows) {
		maxSim = Math.max(maxSim, dismissSimilarity(candidate, dismissed));
	}
	const rawPenalty = maxSim * 45;
	const cappedPenalty = Math.min(rawPenalty, blendedScore * 0.55);
	return Math.max(0, blendedScore - cappedPenalty);
}

/** Min-max normalize scores to 0–100 within a pool (tmdbId keys). */
export function normalizeScores(
	rows: Array<{ key: number; score: number }>,
): Map<number, number> {
	const map = new Map<number, number>();
	if (rows.length === 0) return map;
	const min = Math.min(...rows.map((r) => r.score));
	const max = Math.max(...rows.map((r) => r.score));
	if (max === min) {
		for (const row of rows) map.set(row.key, 100);
		return map;
	}
	for (const row of rows) {
		map.set(row.key, ((row.score - min) / (max - min)) * 100);
	}
	return map;
}

export type MmrCandidate = {
	id: number;
	score: number;
	genreIds: number[];
	year: number | null;
};

function mmrSimilarity(a: MmrCandidate, b: MmrCandidate): number {
	const genreSim = genreJaccardSimilarity(a.genreIds, b.genreIds);
	const decadeA = decadeFromYear(a.year);
	const decadeB = decadeFromYear(b.year);
	const decadeBonus = decadeA != null && decadeA === decadeB ? 0.25 : 0;
	return Math.min(1, genreSim + decadeBonus);
}

/** Greedy MMR — trades raw score for diversity across genre/decade clusters. */
export function mmrSelectCandidates(
	pool: MmrCandidate[],
	options: { limit: number; lambda: number },
): MmrCandidate[] {
	const selected: MmrCandidate[] = [];
	const remaining = [...pool].sort((a, b) => b.score - a.score);
	while (selected.length < options.limit && remaining.length > 0) {
		let bestIdx = 0;
		let bestMmr = Number.NEGATIVE_INFINITY;
		for (let i = 0; i < remaining.length; i += 1) {
			const candidate = remaining[i];
			if (!candidate) continue;
			const maxSim =
				selected.length === 0
					? 0
					: Math.max(...selected.map((s) => mmrSimilarity(candidate, s)));
			const mmr = candidate.score - options.lambda * maxSim * 100;
			if (mmr > bestMmr) {
				bestMmr = mmr;
				bestIdx = i;
			}
		}
		const [picked] = remaining.splice(bestIdx, 1);
		if (picked) selected.push(picked);
	}
	return selected;
}
