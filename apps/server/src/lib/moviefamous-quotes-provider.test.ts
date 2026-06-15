import { describe, expect, test } from "bun:test";

import {
	mapMoviefamousEntryToQuotes,
	matchMoviefamousCatalogEntry,
} from "./moviefamous-quotes-provider";

describe("matchMoviefamousCatalogEntry", () => {
	const catalog = [
		{ id: 0, title: "The Shawshank Redemption", year: "1994", quotes: [] },
		{ id: 1, title: "The Matrix", year: "1999", quotes: [] },
	];

	test("matches by normalized title", () => {
		expect(
			matchMoviefamousCatalogEntry(catalog, "Shawshank Redemption", 1994)?.id,
		).toBe(0);
	});

	test("prefers year when multiple remakes share a title", () => {
		const remakes = [
			{ id: 10, title: "King Kong", year: "1933", quotes: [] },
			{ id: 11, title: "King Kong", year: "2005", quotes: [] },
		];
		expect(matchMoviefamousCatalogEntry(remakes, "King Kong", 2005)?.id).toBe(
			11,
		);
	});
});

describe("mapMoviefamousEntryToQuotes", () => {
	test("parses speaker-prefixed lines", () => {
		const quotes = mapMoviefamousEntryToQuotes({
			id: 5,
			title: "Fight Club",
			year: "1999",
			quotes: ["Tyler Durden: This is your life."],
		});
		expect(quotes).toEqual([
			{
				externalId: "5:0",
				body: "This is your life.",
				speaker: "Tyler Durden",
			},
		]);
	});
});
