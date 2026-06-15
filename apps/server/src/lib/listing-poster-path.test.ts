import { describe, expect, test } from "bun:test";

import { resolveListingPosterPath } from "./listing-poster-path";

describe("resolveListingPosterPath", () => {
	test("prefers the flattened posterPath column", () => {
		expect(
			resolveListingPosterPath("/abc.jpg", { poster_path: "/other.jpg" }),
		).toBe("/abc.jpg");
	});

	test("falls back to tmdb_json.poster_path when column is empty", () => {
		expect(
			resolveListingPosterPath(null, { poster_path: "/from-json.jpg" }),
		).toBe("/from-json.jpg");
		expect(
			resolveListingPosterPath("", { poster_path: "/from-json.jpg" }),
		).toBe("/from-json.jpg");
	});

	test("returns null when neither source has artwork", () => {
		expect(resolveListingPosterPath(null, null)).toBe(null);
		expect(resolveListingPosterPath(null, {})).toBe(null);
		expect(resolveListingPosterPath(null, { poster_path: null })).toBe(null);
	});
});
