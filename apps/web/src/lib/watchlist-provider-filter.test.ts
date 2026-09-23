import { describe, expect, test } from "bun:test";

import {
	formatWatchlistProviderQuery,
	parseWatchlistProviderIds,
	watchlistProviderIdsEqual,
} from "./watchlist-provider-filter";

describe("parseWatchlistProviderIds", () => {
	test("parses comma list, dedupes, sorts asc", () => {
		expect(parseWatchlistProviderIds("350,8,8")).toEqual([8, 350]);
	});
	test("empty → []", () => {
		expect(parseWatchlistProviderIds(null)).toEqual([]);
		expect(parseWatchlistProviderIds("")).toEqual([]);
	});
});

describe("formatWatchlistProviderQuery", () => {
	test("sorts and joins ids", () => {
		expect(formatWatchlistProviderQuery([350, 8])).toBe("8,350");
	});
});

describe("watchlistProviderIdsEqual", () => {
	test("compares sorted id lists", () => {
		expect(watchlistProviderIdsEqual([8, 350], [8, 350])).toBe(true);
		expect(watchlistProviderIdsEqual([8], [8, 350])).toBe(false);
	});
});
