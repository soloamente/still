import { describe, expect, test } from "bun:test";

import {
	formatQuoteTimestampMs,
	parseListingQuoteSort,
	parseQuoteTimestampInput,
	splitQuoteBodyForImport,
	validateListingQuoteScope,
	validateQuoteBody,
	validateQuoteSpeaker,
} from "./listing-quote";

describe("formatQuoteTimestampMs", () => {
	test("formats sub-hour runtime", () => {
		expect(formatQuoteTimestampMs(834_000)).toBe("00:13:54");
	});

	test("formats hour-plus runtime", () => {
		expect(formatQuoteTimestampMs(3_723_000)).toBe("01:02:03");
	});

	test("rejects negative values", () => {
		expect(() => formatQuoteTimestampMs(-1)).toThrow();
	});
});

describe("parseQuoteTimestampInput", () => {
	test("parses H:MM:SS", () => {
		expect(parseQuoteTimestampInput("1:02:03")).toBe(3_723_000);
	});

	test("parses MM:SS", () => {
		expect(parseQuoteTimestampInput("13:54")).toBe(834_000);
	});

	test("returns null for empty input", () => {
		expect(parseQuoteTimestampInput("")).toBeNull();
		expect(parseQuoteTimestampInput("   ")).toBeNull();
	});

	test("throws on invalid segments", () => {
		expect(() => parseQuoteTimestampInput("abc")).toThrow();
		expect(() => parseQuoteTimestampInput("1:99:00")).toThrow();
	});
});

describe("validateQuoteBody", () => {
	test("trims and returns valid body", () => {
		expect(validateQuoteBody("  Hello  ")).toBe("Hello");
	});

	test("rejects empty body", () => {
		expect(() => validateQuoteBody("")).toThrow("Quote text is required");
		expect(() => validateQuoteBody("   ")).toThrow("Quote text is required");
	});

	test("rejects body over max length", () => {
		expect(() => validateQuoteBody("x".repeat(501))).toThrow(
			"Quote text max 500 characters",
		);
	});
});

describe("splitQuoteBodyForImport", () => {
	test("splits long upstream lines into importable chunks", () => {
		const long =
			"A. ".repeat(200) +
			"Final sentence that should land in the second chunk.";
		const parts = splitQuoteBodyForImport(long);
		expect(parts.length).toBeGreaterThan(1);
		for (const part of parts) {
			expect(part.length).toBeLessThanOrEqual(500);
		}
	});
});

describe("validateQuoteSpeaker", () => {
	test("returns null for blank speaker", () => {
		expect(validateQuoteSpeaker(null)).toBeNull();
		expect(validateQuoteSpeaker("  ")).toBeNull();
	});

	test("trims speaker", () => {
		expect(validateQuoteSpeaker("  Neo  ")).toBe("Neo");
	});
});

describe("validateListingQuoteScope", () => {
	test("accepts movie scope", () => {
		expect(validateListingQuoteScope({ movieId: 550, tvId: null })).toEqual({
			movieId: 550,
			tvId: null,
			seasonNumber: null,
			episodeNumber: null,
		});
	});

	test("accepts tv episode scope", () => {
		expect(
			validateListingQuoteScope({
				tvId: 1396,
				seasonNumber: 1,
				episodeNumber: 3,
			}),
		).toEqual({
			movieId: null,
			tvId: 1396,
			seasonNumber: 1,
			episodeNumber: 3,
		});
	});

	test("rejects both movie and tv", () => {
		expect(() => validateListingQuoteScope({ movieId: 1, tvId: 2 })).toThrow();
	});

	test("rejects tv without season and episode", () => {
		expect(() => validateListingQuoteScope({ tvId: 1396 })).toThrow();
	});
});

describe("parseListingQuoteSort", () => {
	test("defaults to upvotes", () => {
		expect(parseListingQuoteSort(undefined)).toBe("upvotes");
	});

	test("accepts newest", () => {
		expect(parseListingQuoteSort("newest")).toBe("newest");
	});
});
