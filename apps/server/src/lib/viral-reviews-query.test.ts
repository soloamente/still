import { describe, expect, test } from "bun:test";

import {
	isViralReviewCandidate,
	parseViralReviewsLimit,
	VIRAL_REVIEW_MAX_BODY_LENGTH,
	VIRAL_REVIEWS_DEFAULT_LIMIT,
	VIRAL_REVIEWS_MAX_LIMIT,
} from "./viral-reviews-query";

describe("isViralReviewCandidate", () => {
	test("allows short body", () => {
		expect(
			isViralReviewCandidate({
				body: "white boys in crop tops again",
				title: null,
			}),
		).toBe(true);
	});

	test("allows title-only", () => {
		expect(isViralReviewCandidate({ body: "", title: "Perfect" })).toBe(true);
	});

	test("rejects long body", () => {
		expect(isViralReviewCandidate({ body: "x".repeat(281), title: null })).toBe(
			false,
		);
	});

	test("allows body at max length", () => {
		expect(
			isViralReviewCandidate({
				body: "x".repeat(VIRAL_REVIEW_MAX_BODY_LENGTH),
				title: null,
			}),
		).toBe(true);
	});

	test("rejects empty body and title", () => {
		expect(isViralReviewCandidate({ body: "", title: null })).toBe(false);
		expect(isViralReviewCandidate({ body: "   ", title: "  " })).toBe(false);
	});
});

describe("parseViralReviewsLimit", () => {
	test("defaults to 6 and caps at max", () => {
		expect(parseViralReviewsLimit(undefined)).toBe(VIRAL_REVIEWS_DEFAULT_LIMIT);
		expect(VIRAL_REVIEWS_DEFAULT_LIMIT).toBe(6);
		expect(parseViralReviewsLimit("99")).toBe(VIRAL_REVIEWS_MAX_LIMIT);
		expect(parseViralReviewsLimit("4")).toBe(4);
	});
});
