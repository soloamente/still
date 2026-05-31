import { describe, expect, test } from "bun:test";

import {
	MAX_PINNED_REVIEWS,
	togglePinnedReviewId,
} from "./profile-pinned-reviews";

describe("togglePinnedReviewId", () => {
	test("adds a review when under the cap", () => {
		expect(togglePinnedReviewId(["rev_a"], "rev_b")).toEqual([
			"rev_a",
			"rev_b",
		]);
	});

	test("removes an existing pin", () => {
		expect(togglePinnedReviewId(["rev_a", "rev_b"], "rev_a")).toEqual([
			"rev_b",
		]);
	});

	test("blocks a fourth pin", () => {
		const result = togglePinnedReviewId(["rev_a", "rev_b", "rev_c"], "rev_d");
		expect(result).toEqual({ error: "max" });
		expect(MAX_PINNED_REVIEWS).toBe(3);
	});
});
