import { describe, expect, test } from "bun:test";

import {
	LANDING_CHAPTER_COPY,
	LANDING_CHAPTERS,
	LANDING_CONVERT_COPY,
	LANDING_CTA,
	LANDING_FOOTER_LINKS,
	LANDING_HERO_BROWSE,
	LANDING_METADATA_DESCRIPTION,
	LANDING_PRODUCT_HEADING,
	LANDING_SKIP_HREF,
} from "./landing-copy";

describe("landing copy contract", () => {
	test("product tabs match Taste Diary Community ids", () => {
		expect(LANDING_CHAPTERS.map((chapter) => chapter.id)).toEqual([
			"taste",
			"diary",
			"community",
		]);
		expect(LANDING_CHAPTERS.map((chapter) => chapter.label)).toEqual([
			"Taste",
			"Diary",
			"Community",
		]);
		expect(LANDING_PRODUCT_HEADING).toBe("How Sense works.");
		expect(LANDING_HERO_BROWSE.map((pill) => pill.label)).toEqual([
			"Movies",
			"TV",
			"Community",
		]);
	});

	test("convert and skip targets stay on the locked routes", () => {
		expect(LANDING_CTA.primary).toEqual({
			href: "/sign-up",
			label: "Create account",
		});
		expect(LANDING_CTA.secondary).toEqual({
			href: "/sign-in",
			label: "Sign in",
		});
		expect(LANDING_SKIP_HREF).toBe("#main-content");
		expect(LANDING_CONVERT_COPY.heading).toBe("Start a free account");
		expect(LANDING_METADATA_DESCRIPTION).toContain("social identity");
		expect(LANDING_FOOTER_LINKS.map((link) => link.href)).toEqual([
			"/pricing",
			"/changelog",
			"/sign-in",
		]);
	});

	test("community copy does not say friends", () => {
		expect(LANDING_CHAPTER_COPY.community.body.toLowerCase()).not.toContain(
			"friend",
		);
	});
});
