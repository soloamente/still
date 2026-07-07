import { describe, expect, test } from "bun:test";

import { parseProfileFavoriteMovieIds } from "./onboarding-favorite-diary-backfill";

describe("parseProfileFavoriteMovieIds", () => {
	test("dedupes and drops invalid ids", () => {
		expect(parseProfileFavoriteMovieIds([1, 1, 2, "x", 3])).toEqual([1, 2, 3]);
	});

	test("returns empty for non-arrays", () => {
		expect(parseProfileFavoriteMovieIds(null)).toEqual([]);
	});
});
