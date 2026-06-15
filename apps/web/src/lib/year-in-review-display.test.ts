import { describe, expect, test } from "bun:test";

import {
	formatYearInReviewAverageRating,
	formatYearInReviewBusiestMonth,
	formatYearInReviewDecade,
	parseYearInReviewYearParam,
} from "./year-in-review-display";

describe("parseYearInReviewYearParam", () => {
	test("accepts valid years", () => {
		expect(parseYearInReviewYearParam("2024")).toBe(2024);
	});

	test("rejects invalid years", () => {
		expect(parseYearInReviewYearParam("abc")).toBe(null);
		expect(parseYearInReviewYearParam("1899")).toBe(null);
	});
});

describe("year in review formatters", () => {
	test("formats decade, month, and rating", () => {
		expect(formatYearInReviewDecade(2010)).toBe("2010s");
		expect(formatYearInReviewBusiestMonth(7)).toBe("July");
		expect(formatYearInReviewAverageRating(8.7)).toBe("8.7");
		expect(formatYearInReviewAverageRating(10)).toBe("10");
	});
});
