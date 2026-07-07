import { describe, expect, test } from "bun:test";

import {
	compactTastePillDisplayLabel,
	legacyVisitorHeadlineFromSelf,
	parseTasteSignatureJson,
	resolveTasteHeadline,
	shouldShowTasteArchetypePill,
	tasteArchetypeDescription,
	tasteSignaturePillLabel,
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

	test("genre-led tooltip names genres when pillGenres present", () => {
		const description = tasteArchetypeDescription("genre-led", "self", {
			primary: "Drama",
			secondary: "Comedy",
			tertiary: "Thriller",
		});
		expect(description).toContain("Drama leads");
		expect(description).toContain("Comedy");
		expect(description).toContain("Thriller");
		expect(description).not.toContain("One genre leads");
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

describe("shouldShowTasteArchetypePill", () => {
	test("shows confident genre-facing archetypes only", () => {
		expect(
			shouldShowTasteArchetypePill({
				archetype: "eclectic",
				headline: "x",
				confidence: "medium",
			}),
		).toBe(true);
		expect(
			shouldShowTasteArchetypePill({
				archetype: "forming",
				headline: "x",
				confidence: "high",
			}),
		).toBe(false);
	});
});

describe("compactTastePillDisplayLabel", () => {
	test("duo labels keep the leading persona", () => {
		expect(compactTastePillDisplayLabel("Dramatist & Toonist")).toBe(
			"Dramatist",
		);
	});

	test("legacy eclectic labels map to single-word personas", () => {
		expect(compactTastePillDisplayLabel("Genre rover")).toBe("Rover");
		expect(compactTastePillDisplayLabel("Restless viewer")).toBe("Rover");
	});

	test("unknown multi-word labels keep the persona noun", () => {
		expect(compactTastePillDisplayLabel("Genre purist")).toBe("Purist");
	});
});

describe("tasteSignaturePillLabel", () => {
	test("prefers pillLabel from JSON", () => {
		expect(
			tasteSignaturePillLabel({
				archetype: "genre-led",
				pillLabel: "Dramatist",
			}),
		).toBe("Dramatist");
	});

	test("compacts stored duo pill labels for display", () => {
		expect(
			tasteSignaturePillLabel({
				archetype: "dual-affinity",
				pillLabel: "Dramatist & Toonist",
			}),
		).toBe("Dramatist");
	});

	test("falls back to single-word archetype pill label", () => {
		expect(
			tasteSignaturePillLabel({
				archetype: "genre-purist",
			}),
		).toBe("Purist");
		expect(
			tasteSignaturePillLabel({
				archetype: "genre-led",
			}),
		).toBe("Genre-led");
	});
});

describe("parseTasteSignatureJson", () => {
	test("parses pillLabel and pillGenres", () => {
		const parsed = parseTasteSignatureJson({
			archetype: "dual-affinity",
			headlineSelf: "Drama and animation run the show.",
			confidence: "high",
			pillLabel: "Dramatist & Toonist",
			pillGenres: {
				primary: "Drama",
				secondary: "Animation",
			},
		});
		expect(parsed?.pillLabel).toBe("Dramatist & Toonist");
		expect(parsed?.pillGenres?.primary).toBe("Drama");
		expect(parsed?.pillGenres?.secondary).toBe("Animation");
	});
});
