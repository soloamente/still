import { describe, expect, test } from "bun:test";

import {
	COMPANION_BEATS,
	COMPANION_FAQ_ITEMS,
	COMPANION_HERO,
	COMPANION_PROBLEM,
	COMPANION_SERVICES,
	COMPANION_SETUP,
} from "./companion-page-copy";

describe("companion-page-copy", () => {
	test("hero uses setup-honest CTA labels without a trust-line meta strip", () => {
		expect(COMPANION_HERO.setupCtaLabel.length).toBeGreaterThan(0);
		expect(COMPANION_HERO.storeCtaLabel.length).toBeGreaterThan(0);
		expect(COMPANION_HERO.headlineLead.length).toBeGreaterThan(20);
		expect(COMPANION_HERO.subline.length).toBeGreaterThan(20);
		expect("trustLine" in COMPANION_HERO).toBe(false);
	});

	test("problem block ends with the fix line", () => {
		expect(COMPANION_PROBLEM.lines.length).toBe(3);
		expect(COMPANION_PROBLEM.fix.toLowerCase()).toContain("companion");
	});

	test("single beat sequence covers Discord, Sense, and diary", () => {
		expect(COMPANION_BEATS.map((item) => item.id)).toEqual([
			"discord",
			"sense",
			"autolog",
		]);
	});

	test("lists core streaming services once in copy", () => {
		expect(COMPANION_SERVICES.map((s) => s.id)).toContain("netflix");
		expect(COMPANION_SERVICES.length).toBeGreaterThanOrEqual(5);
		for (const service of COMPANION_SERVICES) {
			expect(service.logoSrc).toMatch(/^\/companion\/services\/.+\.png$/);
		}
	});

	test("setup has three steps, soon copy, and FAQ answers", () => {
		expect(COMPANION_SETUP.steps).toHaveLength(3);
		expect(COMPANION_SETUP.storeSoonLabel.toLowerCase()).toContain(
			"coming soon",
		);
		expect(COMPANION_FAQ_ITEMS.length).toBeGreaterThanOrEqual(4);
		for (const item of COMPANION_FAQ_ITEMS) {
			expect(item.question.length).toBeGreaterThan(0);
			expect(item.answer.length).toBeGreaterThan(20);
		}
	});
});
