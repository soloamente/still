import { describe, expect, test } from "bun:test";

import { buildTasteHeroStillSlideUrls } from "./home-taste-hero-stills-carousel";

describe("buildTasteHeroStillSlideUrls", () => {
	test("puts fallback first and dedupes screenshot srcs", () => {
		expect(
			buildTasteHeroStillSlideUrls(
				["/b.jpg", "/a.jpg", "/b.jpg"],
				"https://cdn.example/fallback.jpg",
			),
		).toEqual(["https://cdn.example/fallback.jpg", "/b.jpg", "/a.jpg"]);
	});

	test("returns empty when no urls", () => {
		expect(buildTasteHeroStillSlideUrls([], null)).toEqual([]);
	});
});
