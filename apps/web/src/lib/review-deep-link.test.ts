import { describe, expect, test } from "bun:test";

import {
	buildMovieReviewHref,
	parseLegacyReviewPagePath,
} from "./review-deep-link";

describe("review-deep-link", () => {
	test("buildMovieReviewHref encodes review id", () => {
		expect(buildMovieReviewHref(550, "rev_abc")).toBe(
			"/movies/550?review=rev_abc",
		);
	});

	test("parseLegacyReviewPagePath", () => {
		expect(parseLegacyReviewPagePath("/reviews/rev_1")?.reviewId).toBe("rev_1");
		expect(parseLegacyReviewPagePath("/movies/1")).toBeNull();
	});
});
