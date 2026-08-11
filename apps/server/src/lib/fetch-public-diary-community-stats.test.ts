import { describe, expect, test } from "bun:test";

import {
	aggregateResolvedTvPatronScores,
	coercePublicDiaryCommunityStats,
} from "./fetch-public-diary-community-stats";

describe("coercePublicDiaryCommunityStats", () => {
	test("returns null average when no patron ratings", () => {
		expect(
			coercePublicDiaryCommunityStats({ avgRating: null, ratingsCount: 0 }),
		).toEqual({ averageRating: null, ratingsCount: 0 });
	});

	test("coerces avg and distinct patron count", () => {
		expect(
			coercePublicDiaryCommunityStats({ avgRating: "8.25", ratingsCount: "3" }),
		).toEqual({ averageRating: 8.25, ratingsCount: 3 });
	});

	test("ignores average when count is zero", () => {
		expect(
			coercePublicDiaryCommunityStats({ avgRating: 9, ratingsCount: 0 }),
		).toEqual({ averageRating: null, ratingsCount: 0 });
	});
});

describe("aggregateResolvedTvPatronScores", () => {
	test("averages resolved title scores across patrons on the display scale", () => {
		// A: show 90 → 9.0; B: seasons 80+100 → 90 → 9.0; community avg 9.0, count 2
		expect(
			aggregateResolvedTvPatronScores([
				{ userId: "a", logScope: "show", seasonNumber: null, rating: 90 },
				{ userId: "b", logScope: "season", seasonNumber: 1, rating: 80 },
				{ userId: "b", logScope: "season", seasonNumber: 2, rating: 100 },
			]),
		).toEqual({ averageRating: 9, ratingsCount: 2 });
	});

	test("includes season-only patrons and lets show win over seasons for one patron", () => {
		expect(
			aggregateResolvedTvPatronScores([
				{ userId: "solo", logScope: "season", seasonNumber: 1, rating: 70 },
			]),
		).toEqual({ averageRating: 7, ratingsCount: 1 });

		expect(
			aggregateResolvedTvPatronScores([
				{ userId: "mixed", logScope: "show", seasonNumber: null, rating: 90 },
				{
					userId: "mixed",
					logScope: "season",
					seasonNumber: 1,
					rating: 50,
				},
			]),
		).toEqual({ averageRating: 9, ratingsCount: 1 });
	});

	test("returns empty stats when nothing resolves", () => {
		expect(aggregateResolvedTvPatronScores([])).toEqual({
			averageRating: null,
			ratingsCount: 0,
		});
	});
});
