import { describe, expect, test } from "bun:test";

import {
	assertPlausibleTranslation,
	TranslationOutputError,
} from "./review-translation-output";

describe("assertPlausibleTranslation", () => {
	test("accepts a normal translation", () => {
		expect(() =>
			assertPlausibleTranslation(
				"Un film magnifique, vraiment superbe de bout en bout.",
				"A magnificent film, truly superb from start to finish.",
			),
		).not.toThrow();
	});

	test("accepts CJK source that expands a lot in English", () => {
		expect(() =>
			assertPlausibleTranslation(
				"素晴らしい映画でした。最後まで目が離せませんでした。",
				"It was a wonderful movie. I could not take my eyes off it until the very end.",
			),
		).not.toThrow();
	});

	test("rejects an empty reply", () => {
		expect(() =>
			assertPlausibleTranslation("Un film magnifique.", "  "),
		).toThrow(TranslationOutputError);
	});

	test("rejects a reply that is only placeholders when the source has prose", () => {
		expect(() =>
			assertPlausibleTranslation("Voir [[0]] absolument.", "[[0]]"),
		).toThrow(TranslationOutputError);
	});

	test("rejects a long refusal for a long review", () => {
		const source = "Un film magnifique, vraiment superbe de bout en bout.";
		const refusal = "I'm sorry, I cannot help with that request. ".repeat(40);
		expect(() => assertPlausibleTranslation(source, refusal)).toThrow(
			TranslationOutputError,
		);
	});

	test("rejects a one-word reply for a long review", () => {
		const source =
			"Un film magnifique, vraiment superbe de bout en bout. À voir absolument en salle.";
		expect(() => assertPlausibleTranslation(source, "OK")).toThrow(
			TranslationOutputError,
		);
	});

	test("short sources only need to be non-empty", () => {
		expect(() =>
			assertPlausibleTranslation("Génial", "Brilliant"),
		).not.toThrow();
		expect(() =>
			assertPlausibleTranslation("Génial", "Brilliant, absolutely brilliant."),
		).not.toThrow();
	});

	test("a mentions-only body has nothing to compare", () => {
		expect(() =>
			assertPlausibleTranslation("[[0]] [[1]]", "[[1]] [[0]]"),
		).not.toThrow();
	});
});
