import { describe, expect, test } from "bun:test";

import {
	letterboxdStarsToStoredTenths,
	mergeLetterboxdImportRows,
	parseLetterboxdCsv,
} from "./letterboxd-csv";

describe("parseLetterboxdCsv", () => {
	test("parses standard diary header", () => {
		const csv = `Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
Inception,2010,https://boxd.it/abc,4.5,No,,2024-01-15`;
		const rows = parseLetterboxdCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Inception");
		expect(rows[0]?.year).toBe(2010);
		expect(rows[0]?.ratingStars).toBe(4.5);
	});

	test("letterboxdStarsToStoredTenths maps 5 stars to 100", () => {
		expect(letterboxdStarsToStoredTenths(5)).toBe(100);
		expect(letterboxdStarsToStoredTenths(4.5)).toBe(90);
	});

	test("parses 2026 Letterboxd diary export header", () => {
		const csv = `Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-04-25,Marty Supreme,2025,https://boxd.it/e6OOAz,,,,2026-04-25`;
		const rows = parseLetterboxdCsv(csv);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Marty Supreme");
		expect(rows[0]?.watchedAt?.toISOString().slice(0, 10)).toBe("2026-04-25");
	});

	test("mergeLetterboxdImportRows combines diary and ratings by URI", () => {
		const diary =
			parseLetterboxdCsv(`Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date
2026-01-06,Whiplash,2014,https://boxd.it/7bQA,,No,,2026-01-06`);
		const ratings = parseLetterboxdCsv(`Date,Name,Year,Letterboxd URI,Rating
2026-04-26,Whiplash,2014,https://boxd.it/7bQA,4.5`);
		const merged = mergeLetterboxdImportRows([diary, ratings]);
		expect(merged).toHaveLength(1);
		expect(merged[0]?.ratingStars).toBe(4.5);
		expect(merged[0]?.watchedAt?.toISOString().slice(0, 10)).toBe("2026-01-06");
	});
});
