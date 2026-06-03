import { describe, expect, test } from "bun:test";

import { coercePublicDiaryCommunityStats } from "./fetch-public-diary-community-stats";

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
