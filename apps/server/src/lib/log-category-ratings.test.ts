import { describe, expect, test } from "bun:test";

import {
	LOG_CATEGORY_KEYS,
	mergeCategoryRatings,
	parseLogCategoryRatings,
	suggestedOverallFromCategories,
} from "./log-category-ratings";

describe("parseLogCategoryRatings", () => {
	test("keeps valid integer tenths for known keys", () => {
		expect(
			parseLogCategoryRatings({
				plot: 80,
				acting: 65,
				enjoyment: 100,
			}),
		).toEqual({
			plot: 80,
			acting: 65,
			enjoyment: 100,
		});
	});

	test("omits skipped keys — never invents zero", () => {
		const parsed = parseLogCategoryRatings({ plot: 50 });
		expect(parsed).toEqual({ plot: 50 });
		expect(parsed).not.toHaveProperty("characters");
		expect(Object.keys(parsed)).toHaveLength(1);
	});

	test("ignores unknown keys", () => {
		expect(
			parseLogCategoryRatings({
				plot: 70,
				pacing: 90,
				extra: 80,
			}),
		).toEqual({ plot: 70 });
	});

	test("rejects non-integer and out-of-range tenths", () => {
		expect(
			parseLogCategoryRatings({
				plot: 80.5,
				characters: -1,
				writing: 101,
				acting: Number.NaN,
				visuals: "70",
			}),
		).toEqual({});
	});

	test("returns empty object for non-objects", () => {
		expect(parseLogCategoryRatings(null)).toEqual({});
		expect(parseLogCategoryRatings([])).toEqual({});
		expect(parseLogCategoryRatings("plot")).toEqual({});
	});

	test("accepts boundary tenths 0 and 100", () => {
		expect(parseLogCategoryRatings({ sound: 0, enjoyment: 100 })).toEqual({
			sound: 0,
			enjoyment: 100,
		});
	});

	test("only accepts canonical category keys", () => {
		for (const key of LOG_CATEGORY_KEYS) {
			expect(parseLogCategoryRatings({ [key]: 50 })).toEqual({ [key]: 50 });
		}
	});
});

describe("suggestedOverallFromCategories", () => {
	test("mean of present keys on display 0–10 scale", () => {
		expect(
			suggestedOverallFromCategories({
				plot: 80,
				acting: 60,
			}),
		).toBe(7);
	});

	test("ignores skipped categories in the mean", () => {
		expect(
			suggestedOverallFromCategories({
				plot: 90,
				characters: 70,
				writing: 50,
			}),
		).toBe(7);
	});

	test("returns null when no categories rated", () => {
		expect(suggestedOverallFromCategories({})).toBeNull();
	});

	test("single category maps tenths to display", () => {
		expect(suggestedOverallFromCategories({ enjoyment: 87 })).toBe(8.7);
	});

	test("max display is 10", () => {
		expect(
			suggestedOverallFromCategories({
				plot: 100,
				characters: 100,
			}),
		).toBe(10);
	});
});

describe("mergeCategoryRatings", () => {
	test("adds new keys onto an empty map", () => {
		expect(mergeCategoryRatings(null, { plot: 80 })).toEqual({ plot: 80 });
	});

	test("replaces provided keys and keeps the rest", () => {
		expect(
			mergeCategoryRatings({ plot: 80, acting: 60 }, { acting: 75 }),
		).toEqual({ plot: 80, acting: 75 });
	});

	test("null clears a single key", () => {
		expect(
			mergeCategoryRatings({ plot: 80, acting: 60 }, { acting: null }),
		).toEqual({ plot: 80 });
	});

	test("returns null when every key is cleared", () => {
		expect(mergeCategoryRatings({ plot: 80 }, { plot: null })).toBeNull();
	});

	test("ignores unknown keys and invalid values in the patch", () => {
		expect(
			mergeCategoryRatings({ plot: 80 }, {
				vibes: 90,
				acting: 101,
				sound: 7.5,
			} as Record<string, unknown>),
		).toEqual({ plot: 80 });
	});

	test("sanitizes a malformed stored map before merging", () => {
		expect(
			mergeCategoryRatings({ plot: "x", enjoyment: 90 } as unknown, {
				sound: 40,
			}),
		).toEqual({ enjoyment: 90, sound: 40 });
	});
});
