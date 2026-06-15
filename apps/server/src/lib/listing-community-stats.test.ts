import { describe, expect, test } from "bun:test";

import {
	coerceListingCommunityEngagementStats,
	LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT,
	publicListingEngagementCount,
} from "./listing-community-stats";

describe("publicListingEngagementCount", () => {
	test("hides counts below privacy threshold", () => {
		expect(publicListingEngagementCount(0)).toBeNull();
		expect(publicListingEngagementCount(1)).toBeNull();
		expect(publicListingEngagementCount(2)).toBeNull();
	});

	test("shows counts at or above threshold", () => {
		expect(
			publicListingEngagementCount(LISTING_COMMUNITY_ENGAGEMENT_MIN_COUNT),
		).toBe(3);
		expect(publicListingEngagementCount(12)).toBe(12);
	});
});

describe("coerceListingCommunityEngagementStats", () => {
	test("maps raw SQL aggregates to nullable public counts", () => {
		expect(
			coerceListingCommunityEngagementStats({
				watchesRaw: "5",
				watchlistRaw: "2",
			}),
		).toEqual({ watchesCount: 5, watchlistCount: null });
	});

	test("returns nulls when both aggregates are below threshold", () => {
		expect(
			coerceListingCommunityEngagementStats({
				watchesRaw: 0,
				watchlistRaw: 1,
			}),
		).toEqual({ watchesCount: null, watchlistCount: null });
	});
});
