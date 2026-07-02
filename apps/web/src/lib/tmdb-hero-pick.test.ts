import { describe, expect, test } from "bun:test";

import { pickTitleLogoFromTmdbJson } from "./tmdb-title-logo";
import { pickTrailerFromTmdbJson } from "./tmdb-trailer-pick";

describe("tmdb hero pickers (web mirror)", () => {
	test("pickTitleLogoFromTmdbJson reads images.logos", () => {
		const path = pickTitleLogoFromTmdbJson({
			images: {
				logos: [{ file_path: "/logo.png", iso_639_1: "en", vote_average: 5 }],
			},
		});
		expect(path).toBe("/logo.png");
	});

	test("pickTrailerFromTmdbJson reads videos.results", () => {
		const row = pickTrailerFromTmdbJson({
			videos: {
				results: [{ key: "abc", site: "YouTube", type: "Trailer" }],
			},
		});
		expect(row).toEqual({ key: "abc", site: "YouTube" });
	});
});
