import { describe, expect, test } from "bun:test";

import {
	normalizeTitleForQuoteMatch,
	parseSpeakerPrefixedQuoteLine,
} from "./quote-title-match";

describe("normalizeTitleForQuoteMatch", () => {
	test("ignores leading the and punctuation", () => {
		expect(normalizeTitleForQuoteMatch("The Matrix")).toBe("matrix");
		expect(normalizeTitleForQuoteMatch("Fight Club")).toBe("fightclub");
	});
});

describe("parseSpeakerPrefixedQuoteLine", () => {
	test("splits speaker and body", () => {
		expect(
			parseSpeakerPrefixedQuoteLine(
				"Andy Dufresne: Get busy living, or get busy dying.",
			),
		).toEqual({
			speaker: "Andy Dufresne",
			body: "Get busy living, or get busy dying.",
		});
	});

	test("returns whole line when no speaker prefix", () => {
		expect(parseSpeakerPrefixedQuoteLine("Hello world")).toEqual({
			speaker: null,
			body: "Hello world",
		});
	});
});
