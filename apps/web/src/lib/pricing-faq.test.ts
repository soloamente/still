import { describe, expect, test } from "bun:test";

import {
	buildPricingFaqJsonLd,
	PRICING_FAQ_HEADING_ID,
	PRICING_FAQ_ITEMS,
	PRICING_FAQ_SECTION_ID,
	splitFaqAnswerWithLinks,
} from "./pricing-faq";

describe("PRICING_FAQ_ITEMS", () => {
	test("keeps unique stable ids for accordion + JSON-LD", () => {
		const ids = PRICING_FAQ_ITEMS.map((item) => item.id);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain("still-free");
		expect(ids).toContain("plans-differ");
	});

	test("answers stay plain text for FAQPage markup", () => {
		for (const item of PRICING_FAQ_ITEMS) {
			expect(item.answerPlain).not.toMatch(/<[^>]+>/);
			expect(item.question.length).toBeGreaterThan(0);
			expect(item.answerPlain.length).toBeGreaterThan(0);
		}
	});
});

describe("splitFaqAnswerWithLinks", () => {
	test("wraps a compare-plans label without dropping surrounding copy", () => {
		const parts = splitFaqAnswerWithLinks(
			"Each plan stacks. Open Compare plans & features for the matrix.",
			[{ href: "#compare", label: "Compare plans & features" }],
		);

		expect(parts).toEqual([
			{ type: "text", text: "Each plan stacks. Open " },
			{
				type: "link",
				href: "#compare",
				label: "Compare plans & features",
			},
			{ type: "text", text: " for the matrix." },
		]);
	});

	test("returns a single text part when the label is absent", () => {
		expect(
			splitFaqAnswerWithLinks("No link here.", [
				{ href: "#compare", label: "Compare plans & features" },
			]),
		).toEqual([{ type: "text", text: "No link here." }]);
	});
});

describe("buildPricingFaqJsonLd", () => {
	test("emits FAQPage with every question and a page id", () => {
		const ld = buildPricingFaqJsonLd("https://sense.example");

		expect(ld["@context"]).toBe("https://schema.org");
		expect(ld["@type"]).toBe("FAQPage");
		expect(ld["@id"]).toBe(
			`https://sense.example/pricing#${PRICING_FAQ_SECTION_ID}`,
		);
		expect(ld.mainEntity).toHaveLength(PRICING_FAQ_ITEMS.length);

		for (const item of PRICING_FAQ_ITEMS) {
			const entity = ld.mainEntity.find((row) => row.name === item.question);
			expect(entity?.acceptedAnswer.text).toBe(item.answerPlain);
		}
	});

	test("heading and section ids stay aligned for aria-labelledby", () => {
		expect(PRICING_FAQ_HEADING_ID).toBe("pricing-faq-heading");
		expect(PRICING_FAQ_SECTION_ID).toBe("questions");
	});
});
