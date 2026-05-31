import { describe, expect, test } from "bun:test";

import {
	buildSharedGenrePhrase,
	rankSuggestedPatronCandidates,
	SUGGESTED_PATRON_MIN_VIEWER_LOGS,
} from "./suggested-patron-discovery";

describe("suggested-patron-discovery", () => {
	test("exports minimum viewer logs threshold", () => {
		expect(SUGGESTED_PATRON_MIN_VIEWER_LOGS).toBeGreaterThanOrEqual(5);
	});

	test("buildSharedGenrePhrase surfaces overlapping top genres", () => {
		const viewer = new Map([
			[18, 10],
			[53, 6],
			[35, 2],
		]);
		const target = new Map([
			[18, 8],
			[53, 4],
			[80, 9],
		]);
		expect(buildSharedGenrePhrase(viewer, target)).toBe("drama and thriller");
	});

	test("buildSharedGenrePhrase returns null when no genre overlap", () => {
		expect(
			buildSharedGenrePhrase(new Map([[18, 5]]), new Map([[35, 5]])),
		).toBeNull();
	});

	test("rankSuggestedPatronCandidates sorts by compatibility then shared watches", () => {
		const ranked = rankSuggestedPatronCandidates([
			{
				userId: "a",
				handle: "a",
				displayName: "A",
				image: null,
				compatibilityPercent: 40,
				sharedWatches: 20,
				sharedGenrePhrase: null,
			},
			{
				userId: "b",
				handle: "b",
				displayName: "B",
				image: null,
				compatibilityPercent: 72,
				sharedWatches: 8,
				sharedGenrePhrase: "drama",
			},
			{
				userId: "c",
				handle: "c",
				displayName: "C",
				image: null,
				compatibilityPercent: 72,
				sharedWatches: 12,
				sharedGenrePhrase: null,
			},
		]);
		expect(ranked.map((r) => r.userId)).toEqual(["c", "b", "a"]);
	});
});
