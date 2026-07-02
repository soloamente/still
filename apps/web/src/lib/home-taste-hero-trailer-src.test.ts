import { describe, expect, test } from "bun:test";

import { buildTasteHeroTrailerBackgroundSrc } from "./home-taste-hero-trailer-src";

describe("buildTasteHeroTrailerBackgroundSrc", () => {
	test("includes stable origin on YouTube embeds when provided", () => {
		const src = buildTasteHeroTrailerBackgroundSrc(
			"YouTube",
			"abc123",
			"https://sense.example",
		);
		expect(src).toContain("https://www.youtube.com/embed/abc123?");
		expect(src).toContain("origin=https%3A%2F%2Fsense.example");
	});

	test("omits origin when not passed", () => {
		const src = buildTasteHeroTrailerBackgroundSrc("YouTube", "abc123");
		expect(src).not.toContain("origin=");
	});

	test("builds Vimeo background player URL", () => {
		const src = buildTasteHeroTrailerBackgroundSrc("Vimeo", "999");
		expect(src).toBe(
			"https://player.vimeo.com/video/999?background=1&autoplay=1&muted=1&loop=1&badge=0&byline=0&title=0",
		);
	});
});
