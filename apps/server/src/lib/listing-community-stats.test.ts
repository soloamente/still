import { describe, expect, test } from "bun:test";

import { coerceListingCommunityEngagementStats } from "./listing-community-stats";

describe("coerceListingCommunityEngagementStats", () => {
	test("maps raw SQL aggregates to non-negative integers", () => {
		expect(
			coerceListingCommunityEngagementStats({
				watchesRaw: "5",
				listsRaw: "12",
				favoritesRaw: "3",
				watchlistRaw: "2",
			}),
		).toEqual({
			watchesCount: 5,
			listsCount: 12,
			favoritesCount: 3,
			watchlistCount: 2,
		});
	});

	test("returns zeros for empty or invalid aggregates", () => {
		expect(
			coerceListingCommunityEngagementStats({
				watchesRaw: 0,
				listsRaw: null,
				favoritesRaw: undefined,
				watchlistRaw: -4,
			}),
		).toEqual({
			watchesCount: 0,
			listsCount: 0,
			favoritesCount: 0,
			watchlistCount: 0,
		});
	});
});
