import { describe, expect, test } from "bun:test";

import {
	isValidJournalSlug,
	normalizeJournalSlug,
	parseJournalPageLimit,
} from "./journal-post";

describe("normalizeJournalSlug", () => {
	test("lowercases and hyphenates", () => {
		expect(normalizeJournalSlug("Why We Built Sense")).toBe(
			"why-we-built-sense",
		);
	});

	test("strips leading and trailing punctuation", () => {
		expect(normalizeJournalSlug("  --Hello World--  ")).toBe("hello-world");
	});

	test("rejects empty after normalization", () => {
		expect(normalizeJournalSlug("!!!")).toBe("");
	});
});

describe("isValidJournalSlug", () => {
	test("accepts normalized slugs", () => {
		expect(isValidJournalSlug("why-we-built-sense")).toBe(true);
	});

	test("rejects single character", () => {
		expect(isValidJournalSlug("a")).toBe(false);
	});
});

describe("parseJournalPageLimit", () => {
	test("defaults invalid input", () => {
		expect(parseJournalPageLimit(undefined)).toBe(20);
	});

	test("caps at max", () => {
		expect(parseJournalPageLimit("99")).toBe(50);
	});
});
