import { describe, expect, test } from "bun:test";

import {
	migrateLegacyFavoriteMovies,
	parseShowcaseItems,
	validateShowcasePatch,
} from "./profile-showcase";

describe("parseShowcaseItems", () => {
	test("rejects more than 4 items", () => {
		const items = Array.from({ length: 5 }, (_, i) => ({
			kind: "movie" as const,
			id: i + 1,
		}));
		expect(() => parseShowcaseItems(items)).toThrow(/max 4/i);
	});

	test("rejects duplicate movie ids", () => {
		expect(() =>
			parseShowcaseItems([
				{ kind: "movie", id: 1 },
				{ kind: "movie", id: 1 },
			]),
		).toThrow(/duplicate/i);
	});

	test("accepts mixed kinds", () => {
		expect(
			parseShowcaseItems([
				{ kind: "movie", id: 550 },
				{ kind: "tv", id: 1399 },
				{ kind: "review", id: "rev_abc" },
			]),
		).toEqual([
			{ kind: "movie", id: 550 },
			{ kind: "tv", id: 1399 },
			{ kind: "review", id: "rev_abc" },
		]);
	});
});

describe("migrateLegacyFavoriteMovies", () => {
	test("maps favoriteMovieIds when showcase empty", () => {
		expect(migrateLegacyFavoriteMovies([], [550, 680])).toEqual([
			{ kind: "movie", id: 550 },
			{ kind: "movie", id: 680 },
		]);
	});

	test("does not override existing showcase", () => {
		const existing = [{ kind: "tv" as const, id: 1399 }];
		expect(migrateLegacyFavoriteMovies(existing, [550])).toEqual(existing);
	});

	test("caps legacy migration at 4", () => {
		const ids = [1, 2, 3, 4, 5, 6];
		expect(migrateLegacyFavoriteMovies([], ids)).toHaveLength(4);
	});
});

describe("validateShowcasePatch", () => {
	test("accepts review uuid slot", () => {
		expect(
			validateShowcasePatch([{ kind: "review", id: "rev_abc123" }]),
		).toHaveLength(1);
	});
});
