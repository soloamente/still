import { describe, expect, test } from "bun:test";

import { normalizeReviewTranslationResult } from "./review-translation-result";

describe("normalizeReviewTranslationResult", () => {
	test("accepts a same-language short-circuit", () => {
		expect(
			normalizeReviewTranslationResult({
				status: "same_language",
				language: "en",
			}),
		).toEqual({ status: "same_language", language: "en" });
	});

	test("accepts a translated payload and keeps a null title", () => {
		expect(
			normalizeReviewTranslationResult({
				status: "translated",
				language: "en",
				title: null,
				body: "Hello",
				model: "gemini-3.5-flash-lite",
			}),
		).toEqual({
			status: "translated",
			language: "en",
			title: null,
			body: "Hello",
		});
	});

	test("rejects junk and missing bodies", () => {
		expect(normalizeReviewTranslationResult(null)).toBeNull();
		expect(
			normalizeReviewTranslationResult({
				status: "translated",
				language: "en",
			}),
		).toBeNull();
		expect(
			normalizeReviewTranslationResult({
				status: "other",
				language: "en",
				body: "x",
			}),
		).toBeNull();
	});
});
