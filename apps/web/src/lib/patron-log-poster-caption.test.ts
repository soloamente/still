import { describe, expect, test } from "bun:test";

import {
	patronLogPosterCaption,
	rankedListPosterLabels,
} from "@/lib/patron-log-poster-caption";

describe("patronLogPosterCaption", () => {
	test("formats tenths storage as one-decimal display", () => {
		expect(patronLogPosterCaption({ rating: 85, liked: false })).toBe("8.5");
	});

	test("shows Favorite when liked without score", () => {
		expect(patronLogPosterCaption({ rating: null, liked: true })).toBe(
			"Favorite",
		);
	});

	test("returns null when no score or favorite", () => {
		expect(patronLogPosterCaption({ rating: null, liked: false })).toBeNull();
	});
});

describe("rankedListPosterLabels", () => {
	test("puts rank under score when owner logged a rating", () => {
		expect(rankedListPosterLabels(0, { rating: 72, liked: false })).toEqual({
			posterCaption: "7.2",
			posterCaptionSubline: "1",
		});
	});

	test("uses rank alone when no diary score", () => {
		expect(rankedListPosterLabels(2, null)).toEqual({ posterCaption: "3" });
	});
});
