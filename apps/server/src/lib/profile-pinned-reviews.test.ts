import { describe, expect, test } from "bun:test";

import {
	MAX_PINNED_REVIEWS,
	normalizePinnedReviewIds,
} from "./profile-pinned-reviews";

describe("normalizePinnedReviewIds", () => {
	test("dedupes and caps at max pins", () => {
		const ids = normalizePinnedReviewIds([
			"rev_a",
			" rev_b ",
			"rev_a",
			"rev_c",
			"rev_d",
			"rev_e",
		]);
		expect(ids).toEqual(["rev_a", "rev_b", "rev_c"]);
		expect(ids.length).toBeLessThanOrEqual(MAX_PINNED_REVIEWS);
	});

	test("returns empty for non-arrays", () => {
		expect(normalizePinnedReviewIds(null)).toEqual([]);
		expect(normalizePinnedReviewIds("rev_a")).toEqual([]);
	});
});
