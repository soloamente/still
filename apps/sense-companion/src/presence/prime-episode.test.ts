import { describe, expect, test } from "bun:test";

import { parsePrimeVideoEpisode } from "./prime-episode";

describe("parsePrimeVideoEpisode", () => {
	test("reads S4 E1 from the player subtitle", () => {
		expect(parsePrimeVideoEpisode("S4 E1 - The Hellfire Club")).toEqual({
			season: 4,
			episode: 1,
		});
	});

	test("reads a long season and episode label", () => {
		expect(parsePrimeVideoEpisode("Season 2, Episode 8")).toEqual({
			season: 2,
			episode: 8,
		});
	});

	test("a movie subtitle has no episode mark", () => {
		expect(parsePrimeVideoEpisode("Prime Video")).toEqual({
			season: null,
			episode: null,
		});
	});
});
