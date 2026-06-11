// apps/server/src/lib/taste-scoring-math.test.ts
import { describe, expect, test } from "bun:test";

import {
	applyDismissSimilarityPenalty,
	genreJaccardSimilarity,
	mmrSelectCandidates,
	normalizeScores,
	ratingAffinityWeight,
	recencyDecayByIndex,
} from "./taste-scoring-math";

describe("ratingAffinityWeight", () => {
	test("high ratings weigh more than low ratings", () => {
		expect(ratingAffinityWeight(90)).toBeGreaterThan(ratingAffinityWeight(50));
		expect(ratingAffinityWeight(null)).toBe(0.3);
	});
});

describe("recencyDecayByIndex", () => {
	test("newest index has highest decay factor", () => {
		expect(recencyDecayByIndex(0, 5)).toBeGreaterThan(
			recencyDecayByIndex(4, 5),
		);
	});
});

describe("genreJaccardSimilarity", () => {
	test("identical genres score 1", () => {
		expect(genreJaccardSimilarity([18, 53], [18, 53])).toBe(1);
	});
	test("disjoint genres score 0", () => {
		expect(genreJaccardSimilarity([18], [35])).toBe(0);
	});
});

describe("applyDismissSimilarityPenalty", () => {
	test("similar candidate loses score vs unrelated", () => {
		const dismissed = {
			genreIds: [18, 53],
			year: 2015,
			originalLanguage: "en",
		};
		const similar = applyDismissSimilarityPenalty(
			100,
			{
				genreIds: [18, 53],
				year: 2014,
				originalLanguage: "en",
			},
			[dismissed],
		);
		const unrelated = applyDismissSimilarityPenalty(
			100,
			{
				genreIds: [16],
				year: 1990,
				originalLanguage: "ja",
			},
			[dismissed],
		);
		expect(similar).toBeLessThan(unrelated);
		expect(similar).toBeGreaterThan(0);
	});
});

describe("mmrSelectCandidates", () => {
	test("selects diverse genre clusters when available", () => {
		const pool = [
			{ id: 1, score: 100, genreIds: [18], year: 2010 },
			{ id: 2, score: 99, genreIds: [18], year: 2011 },
			{ id: 3, score: 98, genreIds: [18], year: 2012 },
			{ id: 4, score: 90, genreIds: [16], year: 2010 },
		];
		const selected = mmrSelectCandidates(pool, { limit: 3, lambda: 0.35 });
		const ids = selected.map((row) => row.id);
		expect(ids).toContain(4);
	});
});

describe("normalizeScores", () => {
	test("maps max to 100 and min to 0", () => {
		const out = normalizeScores([
			{ key: 1, score: 10 },
			{ key: 2, score: 20 },
		]);
		expect(out.get(2)).toBe(100);
		expect(out.get(1)).toBe(0);
	});
});
