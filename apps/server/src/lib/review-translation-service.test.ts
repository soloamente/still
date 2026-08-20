import { describe, expect, mock, test } from "bun:test";

import {
	normalizeLanguageTag,
	type ReviewTranslationDeps,
	type ReviewTranslationSource,
	resolveReviewTranslation,
} from "./review-translation-service";

describe("normalizeLanguageTag", () => {
	test("collapses region and casing to a base tag", () => {
		expect(normalizeLanguageTag("en")).toBe("en");
		expect(normalizeLanguageTag("en-US")).toBe("en");
		expect(normalizeLanguageTag("PT_br")).toBe("pt");
		expect(normalizeLanguageTag("  ja  ")).toBe("ja");
	});

	test("rejects junk before it can cost a model call", () => {
		expect(normalizeLanguageTag("")).toBeNull();
		expect(normalizeLanguageTag("english")).toBeNull();
		expect(normalizeLanguageTag("1")).toBeNull();
		expect(normalizeLanguageTag("../../etc")).toBeNull();
	});

	test("rejects a phrase whose first word looks like a language subtag", () => {
		// Splitting on "-" first would read this as the valid tag "not".
		expect(normalizeLanguageTag("not-a-language")).toBeNull();
	});
});

const SOURCE: ReviewTranslationSource = {
	id: "rev_1",
	body: "Un film magnifique.",
	title: null,
	sourceLanguage: "fr",
};

function createDeps(
	overrides: Partial<ReviewTranslationDeps> = {},
): ReviewTranslationDeps {
	return {
		loadStored: mock(async () => null),
		saveStored: mock(async () => {}),
		translate: mock(async () => ({
			title: null,
			body: "A magnificent film.",
			model: "test-model",
		})),
		...overrides,
	};
}

describe("resolveReviewTranslation", () => {
	test("short-circuits when the review is already in the target language", async () => {
		const deps = createDeps();
		const outcome = await resolveReviewTranslation(
			{ ...SOURCE, sourceLanguage: "en" },
			"en",
			deps,
		);

		expect(outcome).toEqual({ status: "same_language", language: "en" });
		expect(deps.translate).not.toHaveBeenCalled();
		expect(deps.loadStored).not.toHaveBeenCalled();
	});

	test("reuses a stored translation without paying for a model call", async () => {
		const deps = createDeps({
			loadStored: mock(async () => ({
				title: null,
				body: "A magnificent film.",
				model: "stored-model",
			})),
		});

		const outcome = await resolveReviewTranslation(SOURCE, "en", deps);

		expect(outcome).toEqual({
			status: "translated",
			language: "en",
			title: null,
			body: "A magnificent film.",
			model: "stored-model",
		});
		expect(deps.translate).not.toHaveBeenCalled();
		expect(deps.saveStored).not.toHaveBeenCalled();
	});

	test("translates and persists on a miss so nobody pays twice", async () => {
		const deps = createDeps();
		const outcome = await resolveReviewTranslation(SOURCE, "en", deps);

		expect(outcome).toMatchObject({
			status: "translated",
			language: "en",
			body: "A magnificent film.",
			model: "test-model",
		});
		expect(deps.translate).toHaveBeenCalledTimes(1);
		expect(deps.saveStored).toHaveBeenCalledWith({
			reviewId: "rev_1",
			language: "en",
			title: null,
			body: "A magnificent film.",
			model: "test-model",
		});
	});

	test("still translates when the source language is unknown", async () => {
		const deps = createDeps();
		const outcome = await resolveReviewTranslation(
			{ ...SOURCE, sourceLanguage: null },
			"en",
			deps,
		);

		expect(outcome.status).toBe("translated");
		expect(deps.translate).toHaveBeenCalledTimes(1);
	});

	test("does not persist when the provider fails", async () => {
		const deps = createDeps({
			translate: mock(async () => {
				throw new Error("gateway down");
			}),
		});

		await expect(resolveReviewTranslation(SOURCE, "en", deps)).rejects.toThrow(
			"gateway down",
		);
		expect(deps.saveStored).not.toHaveBeenCalled();
	});
});
