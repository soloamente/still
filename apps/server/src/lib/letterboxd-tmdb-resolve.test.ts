import { describe, expect, test } from "bun:test";

import {
	pickLetterboxdTmdbCandidate,
	releaseYearFromTmdbDate,
} from "./letterboxd-tmdb-resolve";

describe("releaseYearFromTmdbDate", () => {
	test("extracts year from ISO date", () => {
		expect(releaseYearFromTmdbDate("2020-12-25")).toBe(2020);
	});

	test("returns null for empty input", () => {
		expect(releaseYearFromTmdbDate(undefined)).toBeNull();
	});
});

describe("pickLetterboxdTmdbCandidate", () => {
	test("returns first result when year is missing", () => {
		expect(
			pickLetterboxdTmdbCandidate(
				[{ id: 1, release_date: "2010-07-15" }],
				null,
			),
		).toBe(1);
	});

	test("prefers exact release year", () => {
		expect(
			pickLetterboxdTmdbCandidate(
				[
					{ id: 99, release_date: "2025-01-01" },
					{ id: 1, release_date: "2020-12-25" },
				],
				2020,
			),
		).toBe(1);
	});

	test("accepts ±1 year drift between Letterboxd and TMDb", () => {
		expect(
			pickLetterboxdTmdbCandidate(
				[{ id: 508442, release_date: "2020-12-25" }],
				2021,
			),
		).toBe(508442);
	});

	test("returns null when no candidates", () => {
		expect(pickLetterboxdTmdbCandidate([], 2024)).toBeNull();
	});
});
