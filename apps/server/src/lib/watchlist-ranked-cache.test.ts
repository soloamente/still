import { describe, expect, test } from "bun:test";

import { BoundedTtlCache } from "./bounded-ttl-cache";
import {
	invalidateWatchlistRanked,
	readWatchlistRanked,
	sliceWatchlistRankedPage,
	watchlistRankedCacheKey,
	writeWatchlistRanked,
} from "./watchlist-ranked-cache";

describe("sliceWatchlistRankedPage", () => {
	const ranked = Array.from({ length: 5 }, (_, i) => `k${i}`);

	test("page 1 with more left", () => {
		expect(sliceWatchlistRankedPage(ranked, 1, 2)).toEqual({
			rows: ["k0", "k1"],
			totalPages: 2,
			totalResults: 2,
		});
	});

	test("middle page keeps order and advertises the next page", () => {
		expect(sliceWatchlistRankedPage(ranked, 2, 2)).toEqual({
			rows: ["k2", "k3"],
			totalPages: 3,
			totalResults: 4,
		});
	});

	test("last page stops paging", () => {
		expect(sliceWatchlistRankedPage(ranked, 3, 2)).toEqual({
			rows: ["k4"],
			totalPages: 3,
			totalResults: 5,
		});
	});

	test("past the end is empty and reports the previous page as last", () => {
		expect(sliceWatchlistRankedPage(ranked, 5, 2)).toEqual({
			rows: [],
			totalPages: 4,
			totalResults: 8,
		});
	});

	test("empty ranking", () => {
		expect(sliceWatchlistRankedPage([], 1, 24)).toEqual({
			rows: [],
			totalPages: 0,
			totalResults: 0,
		});
	});
});

describe("watchlist ranked cache", () => {
	test("invalidate drops every slice for that patron only", () => {
		const a = watchlistRankedCacheKey({
			userId: "u1",
			order: "tonight",
			region: "US",
			showAdultContent: false,
		});
		const b = watchlistRankedCacheKey({
			userId: "u1",
			order: "available",
			region: "US",
			showAdultContent: false,
		});
		const other = watchlistRankedCacheKey({
			userId: "u10",
			order: "tonight",
			region: null,
			showAdultContent: true,
		});
		writeWatchlistRanked(a, [1]);
		writeWatchlistRanked(b, [2]);
		writeWatchlistRanked(other, [3]);
		invalidateWatchlistRanked("u1");
		expect(readWatchlistRanked(a)).toBeUndefined();
		expect(readWatchlistRanked(b)).toBeUndefined();
		// `u10|` does not start with `u1|`.
		expect(readWatchlistRanked<number>(other)).toEqual([3]);
	});
});

describe("BoundedTtlCache", () => {
	test("expires entries after the TTL", () => {
		let now = 0;
		const cache = new BoundedTtlCache<string>(1000, 10, () => now);
		cache.set("a", "x");
		now = 999;
		expect(cache.get("a")).toBe("x");
		now = 1000;
		expect(cache.get("a")).toBeUndefined();
	});

	test("never grows past the cap; evicts the oldest write", () => {
		const cache = new BoundedTtlCache<number>(60_000, 2);
		cache.set("a", 1);
		cache.set("b", 2);
		cache.set("a", 11); // refresh moves `a` to the young end
		cache.set("c", 3);
		expect(cache.size).toBe(2);
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("a")).toBe(11);
		expect(cache.get("c")).toBe(3);
	});
});
