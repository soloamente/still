import { describe, expect, test } from "bun:test";

import {
	categoryProgressLabel,
	categorySuggestionAction,
	LOG_CATEGORIES,
	suggestedOverallFromCategories,
} from "./log-category-ratings";

describe("LOG_CATEGORIES", () => {
	test("fixed order Plot → Enjoyment (mirrors server keys)", () => {
		expect(LOG_CATEGORIES.map((c) => c.key)).toEqual([
			"plot",
			"characters",
			"writing",
			"acting",
			"visuals",
			"sound",
			"enjoyment",
		]);
		expect(LOG_CATEGORIES[0]?.label).toBe("Plot");
	});
});

describe("suggestedOverallFromCategories", () => {
	test("empty map → null (skipped keys are never zeros)", () => {
		expect(suggestedOverallFromCategories({})).toBeNull();
	});

	test("mean of rated keys only, on the 0–10 display scale, one decimal", () => {
		// 8.0 + 7.0 + 7.5 = 22.5 / 3 = 7.5
		expect(
			suggestedOverallFromCategories({ plot: 80, acting: 70, sound: 75 }),
		).toBe(7.5);
		// 9.0 + 8.0 + 8.0 = 25 / 3 = 8.333… → 8.3
		expect(
			suggestedOverallFromCategories({ plot: 90, writing: 80, visuals: 80 }),
		).toBe(8.3);
	});

	test("a rated 0 counts (it is a real score, not a skip)", () => {
		expect(suggestedOverallFromCategories({ plot: 0, acting: 100 })).toBe(5);
	});
});

describe("categorySuggestionAction", () => {
	test("no categories → nothing to offer", () => {
		expect(categorySuggestionAction(null, null)).toEqual({ kind: "none" });
		expect(categorySuggestionAction(7, null)).toEqual({ kind: "none" });
	});

	test("overall unset → offer the suggestion", () => {
		expect(categorySuggestionAction(null, 7.5)).toEqual({
			kind: "offer",
			display: 7.5,
		});
	});

	test("overall set and different → explicit switch (never auto-overwrite)", () => {
		expect(categorySuggestionAction(8, 7.5)).toEqual({
			kind: "switch",
			display: 7.5,
		});
	});

	test("overall already equals the suggestion → nothing to offer", () => {
		expect(categorySuggestionAction(7.5, 7.5)).toEqual({ kind: "none" });
	});
});

describe("categoryProgressLabel", () => {
	test("1-based N of 7", () => {
		expect(categoryProgressLabel(0)).toBe("1 of 7");
		expect(categoryProgressLabel(6)).toBe("7 of 7");
	});
});
