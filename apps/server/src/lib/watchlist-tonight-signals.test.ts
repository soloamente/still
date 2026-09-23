import { describe, expect, test } from "bun:test";
import {
	listingKey,
	normalizedGenreAffinity,
} from "./watchlist-tonight-signals";

describe("watchlist tonight signal helpers", () => {
	test("listingKey is media-aware", () => {
		expect(listingKey(10, null)).toBe("movie:10");
		expect(listingKey(null, 10)).toBe("tv:10");
	});
	test("genre affinity = best matching genre weight / top weight", () => {
		const weights = new Map([
			[18, 4],
			[878, 2],
		]);
		expect(normalizedGenreAffinity([878], weights)).toBe(0.5);
		expect(normalizedGenreAffinity([18, 878], weights)).toBe(1);
		expect(normalizedGenreAffinity([27], weights)).toBe(0);
		expect(normalizedGenreAffinity([18], new Map())).toBe(0);
	});
});
