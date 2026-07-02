import { describe, expect, test } from "bun:test";

import {
	pickTrailerFromTmdbJson,
	pickTrailerFromVideoResults,
} from "./tmdb-trailer-pick";

describe("pickTrailerFromVideoResults", () => {
	test("prefers official YouTube trailers", () => {
		const picked = pickTrailerFromVideoResults([
			{ key: "teaser", site: "YouTube", type: "Teaser" },
			{ key: "main", site: "YouTube", type: "Trailer" },
		]);
		expect(picked).toEqual({ key: "main", site: "YouTube" });
	});

	test("reads trailers from cached tmdbJson videos", () => {
		const picked = pickTrailerFromTmdbJson({
			videos: {
				results: [{ key: "abc123", site: "YouTube", type: "Trailer" }],
			},
		});
		expect(picked).toEqual({ key: "abc123", site: "YouTube" });
	});
});
