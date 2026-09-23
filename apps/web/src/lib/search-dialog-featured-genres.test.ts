import { describe, expect, test } from "bun:test";

import { buildSearchDialogGenreRailItems } from "./search-dialog-featured-genres";

const GENRES = [
	{ id: 99, name: "Documentary" },
	{ id: 28, name: "Action" },
	{ id: 35, name: "Comedy" },
	{ id: 14, name: "Fantasy" },
	{ id: 27, name: "Horror" },
	{ id: 878, name: "Science Fiction" },
	{ id: 16, name: "Animation" },
	{ id: 12, name: "Adventure" },
	{ id: 10749, name: "Romance" },
	{ id: 53, name: "Thriller" },
];

describe("buildSearchDialogGenreRailItems", () => {
	test("puts Figma featured genres first and inserts Anime after Animation", () => {
		const items = buildSearchDialogGenreRailItems(GENRES, "movie");
		const labels = items.map((item) =>
			item.kind === "curated" ? item.label : item.name,
		);
		expect(labels.slice(0, 10)).toEqual([
			"Fantasy",
			"Action",
			"Horror",
			"Romance",
			"Adventure",
			"Animation",
			"Anime",
			"Thriller",
			"Science Fiction",
			"Documentary",
		]);
	});

	test("appends leftover genres after the featured row", () => {
		const items = buildSearchDialogGenreRailItems(GENRES, "movie");
		const labels = items.map((item) =>
			item.kind === "curated" ? item.label : item.name,
		);
		expect(labels[labels.length - 1]).toBe("Comedy");
	});

	test("skips missing featured names without dropping the rest", () => {
		const items = buildSearchDialogGenreRailItems(
			[
				{ id: 28, name: "Action" },
				{ id: 35, name: "Comedy" },
			],
			"tv",
		);
		expect(items[0]).toEqual({
			kind: "genre",
			id: 28,
			name: "Action",
			listingKind: "tv",
		});
		expect(items.some((item) => item.kind === "curated")).toBe(true);
		expect(
			items.some((item) => item.kind === "genre" && item.name === "Comedy"),
		).toBe(true);
	});
});
