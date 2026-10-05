import { describe, expect, test } from "bun:test";

import { buildListingTrailerPlayerSrc } from "./listing-trailer-embed-src";

describe("buildListingTrailerPlayerSrc", () => {
	test("YouTube embed keeps controls and autoplay", () => {
		const src = buildListingTrailerPlayerSrc(
			"YouTube",
			"abc123",
			"https://sense.test",
		);
		expect(src).toContain("https://www.youtube.com/embed/abc123?");
		expect(src).toContain("autoplay=1");
		expect(src).not.toContain("controls=0");
		expect(src).toContain("origin=https%3A%2F%2Fsense.test");
	});

	test("Vimeo uses the standard player URL", () => {
		const src = buildListingTrailerPlayerSrc("Vimeo", "999");
		expect(src).toBe(
			"https://player.vimeo.com/video/999?autoplay=1&title=0&byline=0&portrait=0",
		);
	});
});
