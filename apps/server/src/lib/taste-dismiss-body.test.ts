import { describe, expect, test } from "bun:test";

import { parseTasteDismissBody } from "./taste-dismiss-body";

describe("parseTasteDismissBody", () => {
	test("a movie id stays on the movie path", () => {
		expect(parseTasteDismissBody({ movieTmdbId: 603 })).toEqual({
			media: "movie",
			tmdbId: 603,
		});
	});

	test("a show id stays on the tv path", () => {
		expect(parseTasteDismissBody({ tvTmdbId: 1399 })).toEqual({
			media: "tv",
			tmdbId: 1399,
		});
	});

	test("both ids, neither id, and non-positive ids are invalid", () => {
		expect(parseTasteDismissBody({ movieTmdbId: 1, tvTmdbId: 2 })).toBeNull();
		expect(parseTasteDismissBody({})).toBeNull();
		expect(parseTasteDismissBody({ tvTmdbId: 0 })).toBeNull();
	});
});
