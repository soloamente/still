import { describe, expect, test } from "bun:test";

import { stampTvTastePayload } from "./taste-matched-discovery-tv";

describe("stampTvTastePayload", () => {
	test("cold start has no titles", () => {
		expect(
			stampTvTastePayload({ coldStart: true, genrePhrase: null, movies: [] }),
		).toEqual({ coldStart: true, genrePhrase: null, movies: [] });
	});

	test("each title is marked tv", () => {
		const payload = stampTvTastePayload({
			coldStart: false,
			genrePhrase: "drama",
			movies: [
				{
					tmdbId: 1399,
					title: "Game of Thrones",
					posterPath: "/a.jpg",
					year: 2011,
				},
			],
		});
		expect(payload.movies[0]).toMatchObject({
			tmdbId: 1399,
			mediaKind: "tv",
		});
	});
});
