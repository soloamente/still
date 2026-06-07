import { describe, expect, test } from "bun:test";

import {
	REVIEW_SPOILER_REVEAL_CTA,
	shouldMaskReviewSpoilers,
} from "./review-spoiler-mask";

describe("shouldMaskReviewSpoilers", () => {
	test("masks spoiler reviews for patrons who have not watched", () => {
		expect(
			shouldMaskReviewSpoilers({
				containsSpoilers: true,
				hasWatchedMovie: false,
			}),
		).toBe(true);
	});

	test("does not mask when the patron has watched", () => {
		expect(
			shouldMaskReviewSpoilers({
				containsSpoilers: true,
				hasWatchedMovie: true,
			}),
		).toBe(false);
	});

	test("does not mask after reveal", () => {
		expect(
			shouldMaskReviewSpoilers({
				containsSpoilers: true,
				hasWatchedMovie: false,
				revealed: true,
			}),
		).toBe(false);
	});

	test("does not mask own reviews", () => {
		expect(
			shouldMaskReviewSpoilers({
				containsSpoilers: true,
				hasWatchedMovie: false,
				isOwnReview: true,
			}),
		).toBe(false);
	});
});

describe("REVIEW_SPOILER_REVEAL_CTA", () => {
	test("uses patron-facing reveal copy", () => {
		expect(REVIEW_SPOILER_REVEAL_CTA).toContain("spoilers");
	});
});
