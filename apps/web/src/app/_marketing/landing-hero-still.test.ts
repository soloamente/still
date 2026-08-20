import { describe, expect, test } from "bun:test";

import { pickLandingHeroPosters } from "./landing-hero-still";

describe("pickLandingHeroPosters", () => {
	test("returns empty for empty or missing lists", () => {
		expect(pickLandingHeroPosters(null)).toEqual([]);
		expect(pickLandingHeroPosters(undefined)).toEqual([]);
		expect(pickLandingHeroPosters([])).toEqual([]);
	});

	test("skips rows without a poster and caps at the limit", () => {
		expect(
			pickLandingHeroPosters(
				[
					{ poster_url: null, title: "Skip" },
					{ poster_url: "   ", title: "Blank" },
					{
						poster_url: "https://image.tmdb.org/t/p/w342/a.jpg",
						title: "A",
					},
					{
						poster_url: "https://image.tmdb.org/t/p/w342/b.jpg",
						title: "B",
					},
					{
						poster_url: "https://image.tmdb.org/t/p/w342/c.jpg",
					},
				],
				2,
			),
		).toEqual([
			{
				posterUrl: "https://image.tmdb.org/t/p/w342/a.jpg",
				title: "A",
			},
			{
				posterUrl: "https://image.tmdb.org/t/p/w342/b.jpg",
				title: "B",
			},
		]);
	});

	test("defaults the cap to 20 for the spiral stream", () => {
		const rows = Array.from({ length: 28 }, (_, index) => ({
			poster_url: `https://image.tmdb.org/t/p/w342/${index}.jpg`,
			title: `T${index}`,
		}));
		expect(pickLandingHeroPosters(rows)).toHaveLength(20);
	});
});
