import { describe, expect, test } from "bun:test";

import {
	resolveSectionNavActiveId,
	type SectionNavBounds,
	sectionIntersectsActivationBand,
} from "./resolve-section-nav-active";

const shortStack: SectionNavBounds[] = [
	{ id: "a", top: 400, bottom: 550 },
	{ id: "b", top: 550, bottom: 700 },
	{ id: "c", top: 700, bottom: 850 },
	{ id: "d", top: 850, bottom: 1000 },
];

describe("resolveSectionNavActiveId", () => {
	test("center mode picks the section under the mid-viewport probe", () => {
		// Viewport 1000; probe at scrollY + 450.
		expect(
			resolveSectionNavActiveId(shortStack, {
				scrollY: 200,
				viewportHeight: 1000,
				documentHeight: 2000,
				activation: "center",
			}),
		).toBe("b"); // probe 650 → in b (550–700)
	});

	test("center mode pins the last section near document end", () => {
		expect(
			resolveSectionNavActiveId(shortStack, {
				scrollY: 980,
				viewportHeight: 1000,
				documentHeight: 2000,
				activation: "center",
			}),
		).toBe("d");
	});

	test("header mode uses the chrome probe line", () => {
		expect(
			resolveSectionNavActiveId(shortStack, {
				scrollY: 500,
				viewportHeight: 1000,
				documentHeight: 3000,
				activation: "header",
				headerProbePx: 120,
			}),
		).toBe("b"); // probe 620 → still in b until 700
	});

	test("header mode also pins the last section at max scroll", () => {
		expect(
			resolveSectionNavActiveId(shortStack, {
				scrollY: 1990,
				viewportHeight: 1000,
				documentHeight: 3000,
				activation: "header",
			}),
		).toBe("d");
	});
});

describe("sectionIntersectsActivationBand", () => {
	test("center band keeps a clicked short section that landed mid-viewport", () => {
		expect(
			sectionIntersectsActivationBand(
				{ top: 600, bottom: 750 },
				{ scrollY: 200, viewportHeight: 1000, activation: "center" },
			),
		).toBe(true);
	});
});
