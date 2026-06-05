import { describe, expect, test } from "bun:test";

import {
	legacyVisitorHeadlineFromSelf,
	resolveTasteHeadline,
	tasteArchetypeDescription,
} from "./sense-taste-signature";

describe("legacyVisitorHeadlineFromSelf", () => {
	test("converts legacy gravitate + contrarian trust line", () => {
		const result = legacyVisitorHeadlineFromSelf(
			"You gravitate toward drama and animation. You trust your own read over the consensus — Five Feet Apart stands out.",
		);
		expect(result.startsWith("Gravitates toward")).toBe(true);
		expect(result).toContain("Five Feet Apart");
		expect(/\bYou\b/i.test(result)).toBe(false);
		expect(/\byour\b/i.test(result)).toBe(false);
	});

	test("genre-led archetype has a patron-facing tooltip", () => {
		const description = tasteArchetypeDescription("genre-led");
		expect(description).toContain("One genre leads");
		expect(description).not.toContain("crowd");
	});

	test("capitalizes visitor headline from resolveTasteHeadline", () => {
		const headline = resolveTasteHeadline(
			{
				headline:
					"You gravitate toward drama and animation. You trust your own read over the consensus — Five Feet Apart stands out.",
				confidence: "medium",
			},
			"visitor",
		);
		expect(headline?.charAt(0)).toBe("G");
	});
});
