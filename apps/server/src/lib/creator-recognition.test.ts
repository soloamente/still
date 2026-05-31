import { describe, expect, test } from "bun:test";

import {
	buildCuratorHeadline,
	curatorSpotlightScore,
	qualifiesAsCurator,
	reviewEngagementScore,
} from "./creator-recognition";

describe("creator-recognition", () => {
	test("review engagement weights likes and comments", () => {
		expect(reviewEngagementScore(4, 2)).toBe(14);
		expect(reviewEngagementScore(0, 0)).toBe(0);
	});

	test("curator qualification favors described lists or reach", () => {
		expect(
			qualifiesAsCurator({
				publicListsCount: 3,
				describedPublicListsCount: 2,
				totalListLikes: 0,
				publicReviewsCount: 0,
				totalReviewLikes: 0,
			}),
		).toBe(true);
		expect(
			qualifiesAsCurator({
				publicListsCount: 0,
				describedPublicListsCount: 0,
				totalListLikes: 0,
				publicReviewsCount: 6,
				totalReviewLikes: 20,
			}),
		).toBe(true);
	});

	test("spotlight score ranks described lists higher", () => {
		const described = curatorSpotlightScore({
			publicListsCount: 4,
			describedPublicListsCount: 3,
			totalListLikes: 10,
			publicReviewsCount: 0,
			totalReviewLikes: 0,
		});
		const thin = curatorSpotlightScore({
			publicListsCount: 4,
			describedPublicListsCount: 0,
			totalListLikes: 10,
			publicReviewsCount: 0,
			totalReviewLikes: 0,
		});
		expect(described).toBeGreaterThan(thin);
	});

	test("headline prefers list likes when present", () => {
		expect(
			buildCuratorHeadline({
				publicListsCount: 5,
				describedPublicListsCount: 3,
				totalListLikes: 42,
				publicReviewsCount: 0,
				totalReviewLikes: 0,
			}),
		).toBe("5 public lists · 42 list likes");
	});

	test("curator qualification via list likes", () => {
		expect(
			qualifiesAsCurator({
				publicListsCount: 1,
				describedPublicListsCount: 0,
				totalListLikes: 30,
				publicReviewsCount: 0,
				totalReviewLikes: 0,
			}),
		).toBe(true);
	});
});
