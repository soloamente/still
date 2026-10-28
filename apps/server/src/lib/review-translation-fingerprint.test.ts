import { describe, expect, test } from "bun:test";

import { reviewTranslationFingerprint } from "./review-translation-fingerprint";

const BASE = { title: "Great", body: "Un film magnifique.", model: "m1" };

describe("reviewTranslationFingerprint", () => {
	test("is stable for identical input", () => {
		expect(reviewTranslationFingerprint(BASE)).toBe(
			reviewTranslationFingerprint({ ...BASE }),
		);
	});

	test("changes when the body changes", () => {
		expect(reviewTranslationFingerprint(BASE)).not.toBe(
			reviewTranslationFingerprint({ ...BASE, body: "Un film nul." }),
		);
	});

	test("changes on a title-only edit", () => {
		expect(reviewTranslationFingerprint(BASE)).not.toBe(
			reviewTranslationFingerprint({ ...BASE, title: "Superbe" }),
		);
	});

	test("changes when the model changes", () => {
		expect(reviewTranslationFingerprint(BASE)).not.toBe(
			reviewTranslationFingerprint({ ...BASE, model: "m2" }),
		);
	});

	test("a missing title differs from an empty one", () => {
		expect(reviewTranslationFingerprint({ ...BASE, title: null })).not.toBe(
			reviewTranslationFingerprint({ ...BASE, title: "" }),
		);
	});

	test("field boundaries cannot be forged by moving text between fields", () => {
		expect(
			reviewTranslationFingerprint({ title: "a", body: "bc", model: "m" }),
		).not.toBe(
			reviewTranslationFingerprint({ title: "ab", body: "c", model: "m" }),
		);
	});
});
