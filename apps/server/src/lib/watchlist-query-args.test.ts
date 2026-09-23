import { describe, expect, test } from "bun:test";

import {
	parseWatchlistLimit,
	parseWatchlistOrder,
	parseWatchlistPage,
	WATCHLIST_DEFAULT_LIMIT,
	WATCHLIST_MAX_LIMIT,
	watchlistLookaheadPageMeta,
	watchlistOffset,
	watchlistTotalPages,
} from "./watchlist-query-args";

describe("parseWatchlistPage", () => {
	test("defaults to 1 for missing / junk / sub-1 values", () => {
		expect(parseWatchlistPage(undefined)).toBe(1);
		expect(parseWatchlistPage("nope")).toBe(1);
		expect(parseWatchlistPage("0")).toBe(1);
		expect(parseWatchlistPage("-4")).toBe(1);
	});
	test("floors valid pages", () => {
		expect(parseWatchlistPage("3")).toBe(3);
		expect(parseWatchlistPage("3.9")).toBe(3);
	});
});

describe("parseWatchlistLimit", () => {
	test("defaults when missing / junk / sub-1", () => {
		expect(parseWatchlistLimit(undefined)).toBe(WATCHLIST_DEFAULT_LIMIT);
		expect(parseWatchlistLimit("nope")).toBe(WATCHLIST_DEFAULT_LIMIT);
		expect(parseWatchlistLimit("0")).toBe(WATCHLIST_DEFAULT_LIMIT);
	});
	test("clamps to max", () => {
		expect(parseWatchlistLimit("9999")).toBe(WATCHLIST_MAX_LIMIT);
	});
	test("passes through valid limits", () => {
		expect(parseWatchlistLimit("12")).toBe(12);
	});
});

describe("parseWatchlistOrder", () => {
	test("accepts known orders", () => {
		expect(parseWatchlistOrder("earliest_added")).toBe("earliest_added");
		expect(parseWatchlistOrder("title_az")).toBe("title_az");
		expect(parseWatchlistOrder("latest_added")).toBe("latest_added");
	});
	test("defaults unknown to latest_added", () => {
		expect(parseWatchlistOrder(undefined)).toBe("latest_added");
		expect(parseWatchlistOrder("garbage")).toBe("latest_added");
	});
});

describe("watchlistOffset", () => {
	test("page 1 → 0; page 3, limit 24 → 48", () => {
		expect(watchlistOffset(1, 24)).toBe(0);
		expect(watchlistOffset(3, 24)).toBe(48);
	});
});

describe("watchlistTotalPages", () => {
	test("ceils total / limit; 0 for empty", () => {
		expect(watchlistTotalPages(0, 24)).toBe(0);
		expect(watchlistTotalPages(24, 24)).toBe(1);
		expect(watchlistTotalPages(25, 24)).toBe(2);
	});
});

describe("watchlistLookaheadPageMeta", () => {
	test("page 1 empty → 0 pages", () => {
		expect(
			watchlistLookaheadPageMeta({ page: 1, limit: 24, fetchedCount: 0 }),
		).toEqual({ visibleCount: 0, hasMore: false, totalPages: 0 });
	});

	test("page 1 partial → one page, no lookahead", () => {
		expect(
			watchlistLookaheadPageMeta({ page: 1, limit: 24, fetchedCount: 10 }),
		).toEqual({ visibleCount: 10, hasMore: false, totalPages: 1 });
	});

	test("page 1 full with lookahead row → at least page 2", () => {
		expect(
			watchlistLookaheadPageMeta({ page: 1, limit: 24, fetchedCount: 25 }),
		).toEqual({ visibleCount: 24, hasMore: true, totalPages: 2 });
	});

	test("page 2 empty (past the end) → clamp to page 1", () => {
		expect(
			watchlistLookaheadPageMeta({ page: 2, limit: 24, fetchedCount: 0 }),
		).toEqual({ visibleCount: 0, hasMore: false, totalPages: 1 });
	});

	test("page 2 partial → last page is 2", () => {
		expect(
			watchlistLookaheadPageMeta({ page: 2, limit: 24, fetchedCount: 3 }),
		).toEqual({ visibleCount: 3, hasMore: false, totalPages: 2 });
	});
});
