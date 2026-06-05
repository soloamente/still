import { describe, expect, it } from "bun:test";
import { classifyJikanAnimeAdult } from "./adult-jikan-classify";

describe("classifyJikanAnimeAdult", () => {
	it("Rx rating is adult", () => {
		expect(
			classifyJikanAnimeAdult({ rating: "Rx - Hentai", genres: [] }),
		).toEqual({ isAdult: true, sources: ["mal_rating"] });
	});
	it("Hentai genre is adult", () => {
		expect(
			classifyJikanAnimeAdult({
				rating: "R - 17+ (violence & profanity)",
				genres: [{ name: "Hentai" }],
			}),
		).toEqual({ isAdult: true, sources: ["mal_genre"] });
	});
	it("PG anime is not adult", () => {
		expect(
			classifyJikanAnimeAdult({
				rating: "PG-13 - Teens 13 or older",
				genres: [{ name: "Action" }],
			}),
		).toEqual({ isAdult: false, sources: [] });
	});
});
