import { describe, expect, test } from "bun:test";

import { parseTvQuoteEpisodeParams } from "./listing-quotes-query";

describe("parseTvQuoteEpisodeParams", () => {
	test("parses positive season and episode", () => {
		expect(parseTvQuoteEpisodeParams({ season: "2", episode: "5" })).toEqual({
			seasonNumber: 2,
			episodeNumber: 5,
		});
	});

	test("truncates fractional values", () => {
		expect(
			parseTvQuoteEpisodeParams({ season: "1.9", episode: "3.1" }),
		).toEqual({
			seasonNumber: 1,
			episodeNumber: 3,
		});
	});

	test("returns null when season missing", () => {
		expect(parseTvQuoteEpisodeParams({ episode: "1" })).toBeNull();
	});

	test("returns null when episode missing", () => {
		expect(parseTvQuoteEpisodeParams({ season: "1" })).toBeNull();
	});

	test("returns null for zero or negative numbers", () => {
		expect(parseTvQuoteEpisodeParams({ season: "0", episode: "1" })).toBeNull();
		expect(
			parseTvQuoteEpisodeParams({ season: "1", episode: "-2" }),
		).toBeNull();
	});

	test("returns null for non-numeric input", () => {
		expect(parseTvQuoteEpisodeParams({ season: "x", episode: "1" })).toBeNull();
	});
});
