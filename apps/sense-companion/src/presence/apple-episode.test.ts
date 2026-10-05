import { describe, expect, test } from "bun:test";

import { parseAppleTvEpisode } from "./apple-episode";

describe("parseAppleTvEpisode", () => {
	test("reads S1, E2 from the player subtitle", () => {
		expect(parseAppleTvEpisode("S1, E2 · The First")).toEqual({
			season: 1,
			episode: 2,
		});
	});

	test("reads a long season and episode label", () => {
		expect(
			parseAppleTvEpisode("Season 4, Episode 1 · The Hellfire Club"),
		).toEqual({
			season: 4,
			episode: 1,
		});
	});

	test("a movie has no episode mark", () => {
		expect(parseAppleTvEpisode(null)).toEqual({
			season: null,
			episode: null,
		});
	});
});
