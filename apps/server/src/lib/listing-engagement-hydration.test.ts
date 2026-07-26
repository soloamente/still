import { describe, expect, mock, test } from "bun:test";

import * as diaryMetalTier from "./diary-metal-tier";

mock.module("./diary-metal-tier", () => ({
	...diaryMetalTier,
	fetchDiaryLogCountsForUserIds: mock(async (userIds: string[]) => {
		const counts = new Map<string, number>();
		for (const userId of userIds) {
			counts.set(userId, userId === "u1" ? 100 : 0);
		}
		return counts;
	}),
}));

mock.module("./patron-plan-tier", () => ({
	fetchPlanTiersForUserIds: mock(async (userIds: string[]) => {
		const tiers = new Map<string, "immersed">();
		for (const userId of userIds) {
			if (userId === "u1") {
				tiers.set(userId, "immersed");
			}
		}
		return tiers;
	}),
	planTierForUserId: (
		userId: string,
		tiers: Map<string, "immersed" | "still">,
	) => tiers.get(userId) ?? "still",
}));

const {
	mapListingEngagementPatronRowsForTest,
	mapListingEngagementWatchRowsForTest,
} = await import("./listing-engagement-query");

describe("listing engagement patron hydration", () => {
	test("includes diaryMetalTier and planTier on patron rows", async () => {
		const items = await mapListingEngagementPatronRowsForTest([
			{
				userId: "u1",
				handle: "alpha",
				displayName: "Alpha",
				image: null,
				preferences: {},
				rating: 85,
				liked: true,
				sortAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			{
				userId: "u2",
				handle: "beta",
				displayName: "Beta",
				image: null,
				preferences: {},
				rating: null,
				liked: false,
				sortAt: new Date("2026-01-02T00:00:00.000Z"),
			},
		]);

		expect(items[0]?.diaryMetalTier).toBe("gold");
		expect(items[0]?.planTier).toBe("immersed");
		expect(items[1]?.diaryMetalTier).toBeNull();
		expect(items[1]?.planTier).toBe("still");
	});
});

describe("listing engagement watch hydration", () => {
	test("includes diaryMetalTier and planTier on watch rows", async () => {
		const items = await mapListingEngagementWatchRowsForTest([
			{
				userId: "u1",
				handle: "alpha",
				displayName: "Alpha",
				image: null,
				preferences: {},
				logRating: 90,
				liked: false,
				watchedAt: new Date("2026-01-01T00:00:00.000Z"),
				reviewId: null,
				reviewTitle: null,
				reviewBody: null,
				reviewRating: null,
				reviewLikesCount: null,
				reviewPublishedAt: null,
				reviewContainsSpoilers: null,
			},
		]);

		expect(items[0]?.diaryMetalTier).toBe("gold");
		expect(items[0]?.planTier).toBe("immersed");
	});
});
