import { describe, expect, test } from "bun:test";

import {
	parseSavedQuotesKind,
	parseSavedQuotesVisibility,
} from "./listing-quote-saves-query";

describe("parseSavedQuotesKind", () => {
	test("accepts movie and tv", () => {
		expect(parseSavedQuotesKind("movie")).toBe("movie");
		expect(parseSavedQuotesKind("tv")).toBe("tv");
	});

	test("returns null for unknown values", () => {
		expect(parseSavedQuotesKind(undefined)).toBeNull();
		expect(parseSavedQuotesKind("all")).toBeNull();
	});
});

describe("parseSavedQuotesVisibility", () => {
	test("accepts visibility enum values", () => {
		expect(parseSavedQuotesVisibility("public")).toBe("public");
		expect(parseSavedQuotesVisibility("private")).toBe("private");
	});

	test("returns null when omitted", () => {
		expect(parseSavedQuotesVisibility(undefined)).toBeNull();
	});
});
