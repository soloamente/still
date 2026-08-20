import { describe, expect, test } from "bun:test";

import {
	PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE,
	readReviewTranslationLanguagePref,
} from "./profile-preferences";
import {
	normalizeReviewTranslationLanguage,
	REVIEW_TRANSLATION_LANGUAGE_OPTIONS,
	resolveReviewTranslationLanguage,
	reviewLanguageDisplayName,
} from "./review-translation-language";

describe("normalizeReviewTranslationLanguage", () => {
	test("collapses region subtags so en-US and en-GB share a translation", () => {
		expect(normalizeReviewTranslationLanguage("en-US")).toBe("en");
		expect(normalizeReviewTranslationLanguage("en-GB")).toBe("en");
		expect(normalizeReviewTranslationLanguage("pt_BR")).toBe("pt");
	});

	test("lowercases and trims", () => {
		expect(normalizeReviewTranslationLanguage("  JA  ")).toBe("ja");
	});

	test("rejects junk", () => {
		expect(normalizeReviewTranslationLanguage("")).toBeNull();
		expect(normalizeReviewTranslationLanguage("   ")).toBeNull();
		expect(normalizeReviewTranslationLanguage(null)).toBeNull();
		expect(normalizeReviewTranslationLanguage("../../etc/passwd")).toBeNull();
		expect(normalizeReviewTranslationLanguage("english")).toBeNull();
		expect(normalizeReviewTranslationLanguage("e")).toBeNull();
	});

	test("keeps three-letter tags", () => {
		expect(normalizeReviewTranslationLanguage("fil")).toBe("fil");
	});
});

describe("resolveReviewTranslationLanguage", () => {
	test("preference wins over browser language", () => {
		expect(
			resolveReviewTranslationLanguage({
				preference: "ja",
				navigatorLanguage: "en-US",
			}),
		).toBe("ja");
	});

	test("falls back to browser language when unset", () => {
		expect(
			resolveReviewTranslationLanguage({
				preference: null,
				navigatorLanguage: "fr-CA",
			}),
		).toBe("fr");
	});

	test("accepts a browser language outside the Settings option list", () => {
		expect(
			resolveReviewTranslationLanguage({
				preference: null,
				navigatorLanguage: "cs-CZ",
			}),
		).toBe("cs");
	});

	test("falls back to English when both are missing or junk", () => {
		expect(
			resolveReviewTranslationLanguage({
				preference: "not-a-language",
				navigatorLanguage: undefined,
			}),
		).toBe("en");
	});
});

describe("reviewLanguageDisplayName", () => {
	test("names a language in English by default", () => {
		expect(reviewLanguageDisplayName("ja")).toBe("Japanese");
	});

	test("names a language in the reader's locale", () => {
		expect(reviewLanguageDisplayName("ja", "fr")).toBe("japonais");
	});

	test("returns the tag rather than throwing on junk", () => {
		expect(reviewLanguageDisplayName("!!")).toBe("!!");
	});
});

describe("readReviewTranslationLanguagePref", () => {
	test("reads and normalizes a stored tag", () => {
		expect(
			readReviewTranslationLanguagePref({
				[PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE]: "pt-BR",
			}),
		).toBe("pt");
	});

	test("treats missing, empty, and non-string values as unset", () => {
		expect(readReviewTranslationLanguagePref(null)).toBeNull();
		expect(readReviewTranslationLanguagePref({})).toBeNull();
		expect(
			readReviewTranslationLanguagePref({
				[PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE]: "",
			}),
		).toBeNull();
		expect(
			readReviewTranslationLanguagePref({
				[PROFILE_PREF_REVIEW_TRANSLATION_LANGUAGE]: 42,
			}),
		).toBeNull();
	});
});

describe("REVIEW_TRANSLATION_LANGUAGE_OPTIONS", () => {
	test("every option value is already a normalized base tag", () => {
		for (const option of REVIEW_TRANSLATION_LANGUAGE_OPTIONS) {
			expect(normalizeReviewTranslationLanguage(option.value)).toBe(
				option.value,
			);
		}
	});

	test("has no duplicate values", () => {
		const values = REVIEW_TRANSLATION_LANGUAGE_OPTIONS.map((o) => o.value);
		expect(new Set(values).size).toBe(values.length);
	});
});
