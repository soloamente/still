import { describe, expect, test } from "bun:test";

import { maxWatchFromPlayback } from "./max-watch";

describe("maxWatchFromPlayback", () => {
	test("an episode keeps the show title and S4 E1", () => {
		expect(
			maxWatchFromPlayback({
				showTitle: "The Last of Us",
				isMovie: false,
				season: 4,
				episode: 1,
			}),
		).toEqual({
			provider: "max",
			kind: "episode",
			title: "The Last of Us",
			season: 4,
			episode: 1,
		});
	});

	test("a movie has no episode mark", () => {
		expect(
			maxWatchFromPlayback({
				showTitle: "Dune",
				isMovie: true,
				season: null,
				episode: null,
			}),
		).toEqual({
			provider: "max",
			kind: "movie",
			title: "Dune",
			season: null,
			episode: null,
		});
	});

	test("a missing title is not a watch", () => {
		expect(
			maxWatchFromPlayback({
				showTitle: "  ",
				isMovie: false,
				season: 1,
				episode: 1,
			}),
		).toBeNull();
	});
});
