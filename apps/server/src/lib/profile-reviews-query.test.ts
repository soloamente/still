import { describe, expect, test } from "bun:test";

import {
	parseProfileReviewsLimit,
	parseProfileReviewsPage,
	profileReviewsTotalPages,
} from "./profile-reviews-query";

describe("profileReviewsTotalPages", () => {
	test("returns zero when empty", () => {
		expect(profileReviewsTotalPages(0, 20)).toBe(0);
	});

	test("ceil-divides totals", () => {
		expect(profileReviewsTotalPages(21, 20)).toBe(2);
	});
});

describe("parseProfileReviewsPage", () => {
	test("defaults invalid to page 1", () => {
		expect(parseProfileReviewsPage(undefined)).toBe(1);
		expect(parseProfileReviewsPage("0")).toBe(1);
	});
});

describe("parseProfileReviewsLimit", () => {
	test("caps at 50", () => {
		expect(parseProfileReviewsLimit("99")).toBe(50);
	});
});
