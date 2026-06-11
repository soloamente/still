import { describe, expect, test } from "bun:test";

import {
	mergeBlendAndPenalizeCandidates,
	TASTE_MATCH_MIN_LOGS,
	TASTE_MATCH_MIN_RESULTS,
} from "./taste-matched-discovery";

describe("taste-matched-discovery thresholds", () => {
	test("matches ST.4 success criteria", () => {
		expect(TASTE_MATCH_MIN_LOGS).toBe(10);
		expect(TASTE_MATCH_MIN_RESULTS).toBe(6);
	});
});

describe("mergeBlendAndPenalizeCandidates", () => {
	const baseCandidate = (tmdbId: number, genreIds: number[], year: number) => ({
		tmdbId,
		row: {
			tmdbId,
			title: `Film ${tmdbId}`,
			posterPath: null,
			year,
		},
		genreIds,
		year,
		originalLanguage: "en",
		popularity: 20,
	});

	test("activates social blend when at least five social candidates exist", () => {
		const candidates = [1, 2, 3, 4, 5, 6].map((id) =>
			baseCandidate(id, [18], 2010 + id),
		);
		const soloScores = new Map(
			candidates.map((candidate) => [candidate.tmdbId, 10]),
		);
		const socialScores = new Map([
			[1, 10],
			[2, 20],
			[3, 30],
			[4, 40],
			[5, 50],
			[6, 5],
		]);

		const blended = mergeBlendAndPenalizeCandidates({
			candidates,
			soloScores,
			socialScores,
			dismissMetadata: [],
		});

		expect(blended.find((row) => row.row.tmdbId === 5)?.score).toBeGreaterThan(
			blended.find((row) => row.row.tmdbId === 6)?.score ?? 0,
		);
	});

	test("dismiss penalty lowers similar candidate vs unrelated", () => {
		const candidates = [
			baseCandidate(1, [18, 53], 2014),
			baseCandidate(2, [16], 1990),
		];
		const soloScores = new Map([
			[1, 100],
			[2, 100],
		]);

		const withDismiss = mergeBlendAndPenalizeCandidates({
			candidates,
			soloScores,
			socialScores: new Map(),
			dismissMetadata: [
				{ genreIds: [18, 53], year: 2015, originalLanguage: "en" },
			],
		});

		const withoutDismiss = mergeBlendAndPenalizeCandidates({
			candidates,
			soloScores,
			socialScores: new Map(),
			dismissMetadata: [],
		});

		const similarPenalized =
			withDismiss.find((row) => row.row.tmdbId === 1)?.score ?? 0;
		const unrelatedPenalized =
			withDismiss.find((row) => row.row.tmdbId === 2)?.score ?? 0;
		const similarControl =
			withoutDismiss.find((row) => row.row.tmdbId === 1)?.score ?? 0;

		expect(similarPenalized).toBeLessThan(similarControl);
		expect(similarPenalized).toBeLessThan(unrelatedPenalized);
	});
});
