import { describe, expect, test } from "bun:test";

import {
	parseWatchlistProviderIds,
	titleFlatrateIncludesAllProviders,
} from "./watchlist-provider-filter";

describe("parseWatchlistProviderIds", () => {
	test("parses comma list, dedupes, sorts asc", () => {
		expect(parseWatchlistProviderIds("350,8,8")).toEqual([8, 350]);
	});
	test("empty → []", () => {
		expect(parseWatchlistProviderIds(null)).toEqual([]);
		expect(parseWatchlistProviderIds("")).toEqual([]);
		expect(parseWatchlistProviderIds("nope,0,-1")).toEqual([]);
	});
});

describe("titleFlatrateIncludesAllProviders", () => {
	const json = {
		"watch/providers": {
			results: {
				US: {
					flatrate: [
						{ provider_id: 8, provider_name: "Netflix" },
						{ provider_id: 350, provider_name: "Apple TV" },
					],
				},
			},
		},
	};

	test("AND: both ids present → true", () => {
		expect(titleFlatrateIncludesAllProviders(json, "US", [8, 350])).toBe(true);
	});
	test("missing one → false", () => {
		expect(titleFlatrateIncludesAllProviders(json, "US", [8, 999])).toBe(false);
	});
	test("empty provider list → true (no filter)", () => {
		expect(titleFlatrateIncludesAllProviders(json, "US", [])).toBe(true);
	});
});
