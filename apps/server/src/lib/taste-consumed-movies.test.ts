import { describe, expect, test } from "bun:test";

import { filterConsumedTasteMovies } from "./taste-consumed-movies";
import type { TasteMatchMovie } from "./taste-matched-discovery";

function film(tmdbId: number): TasteMatchMovie {
	return {
		tmdbId,
		title: `Film ${tmdbId}`,
		posterPath: null,
		year: 2020,
	};
}

describe("filterConsumedTasteMovies", () => {
	test("removes watchlisted and logged ids", () => {
		const movies = [film(1), film(2), film(3)];
		const out = filterConsumedTasteMovies(movies, new Set([2, 3]));
		expect(out.map((row) => row.tmdbId)).toEqual([1]);
	});

	test("returns empty array when every title is consumed", () => {
		const movies = [film(10), film(11)];
		expect(filterConsumedTasteMovies(movies, new Set([10, 11]))).toEqual([]);
	});

	test("returns input unchanged when consumed set is empty", () => {
		const movies = [film(5)];
		expect(filterConsumedTasteMovies(movies, new Set())).toEqual(movies);
	});
});
