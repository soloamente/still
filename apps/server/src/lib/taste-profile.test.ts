// apps/server/src/lib/taste-profile.test.ts
import { describe, expect, test } from "bun:test";

import {
	applyRepeatGenreDownweight,
	buildDismissNegativeProfile,
	buildWeightedTasteProfile,
	scoreSoloCandidate,
} from "./taste-profile";

describe("buildWeightedTasteProfile", () => {
	test("high-rated horror outweighs low-rated comedy frequency", () => {
		const profile = buildWeightedTasteProfile([
			{
				genreIds: [27],
				rating: 95,
				year: 2010,
				originalLanguage: "en",
				popularity: 5,
				index: 0,
				total: 2,
			},
			{
				genreIds: [27],
				rating: 90,
				year: 2011,
				originalLanguage: "en",
				popularity: 6,
				index: 1,
				total: 2,
			},
			{
				genreIds: [35],
				rating: 40,
				year: 2012,
				originalLanguage: "en",
				popularity: 80,
				index: 2,
				total: 3,
			},
			{
				genreIds: [35],
				rating: 45,
				year: 2013,
				originalLanguage: "en",
				popularity: 90,
				index: 3,
				total: 4,
			},
			{
				genreIds: [35],
				rating: 50,
				year: 2014,
				originalLanguage: "en",
				popularity: 100,
				index: 4,
				total: 5,
			},
		]);
		expect(profile.genreWeights.get(27) ?? 0).toBeGreaterThan(
			profile.genreWeights.get(35) ?? 0,
		);
	});
});

describe("buildDismissNegativeProfile", () => {
	test("repeat genre triggers negative weight", () => {
		const negative = buildDismissNegativeProfile([
			{ genreIds: [53], year: 2010, originalLanguage: "en", popularity: 10 },
			{
				genreIds: [53, 18],
				year: 2012,
				originalLanguage: "en",
				popularity: 12,
			},
		]);
		expect(negative.repeatGenreCounts.get(53)).toBe(2);
	});
});

describe("applyRepeatGenreDownweight", () => {
	test("two dismissals in same genre reduce solo score", () => {
		const profile = buildWeightedTasteProfile([
			{
				genreIds: [53],
				rating: 80,
				year: 2010,
				originalLanguage: "en",
				popularity: 10,
				index: 0,
				total: 1,
			},
		]);
		const negative = buildDismissNegativeProfile([
			{ genreIds: [53], year: 2010, originalLanguage: "en", popularity: 10 },
			{ genreIds: [53], year: 2012, originalLanguage: "en", popularity: 12 },
		]);
		const base = scoreSoloCandidate(
			{
				genreIds: [53],
				year: 2015,
				originalLanguage: "en",
				popularity: 20,
			},
			profile,
			{ nicheBoost: false, viewerPopularityP75: 50 },
		);
		const penalized = applyRepeatGenreDownweight(
			base,
			{
				genreIds: [53],
				year: 2015,
				originalLanguage: "en",
				popularity: 20,
			},
			profile,
			negative,
		);
		expect(penalized).toBeLessThan(base);
	});
});
