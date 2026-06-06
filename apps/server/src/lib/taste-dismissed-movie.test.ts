import { describe, expect, test } from "bun:test";

import { pickNextTasteMatchCandidate } from "./taste-dismissed-movie";

const candidates = [
	{
		row: {
			tmdbId: 1,
			title: "A",
			posterPath: null,
			year: 2020,
		},
		score: 10,
	},
	{
		row: {
			tmdbId: 2,
			title: "B",
			posterPath: null,
			year: 2021,
		},
		score: 20,
	},
];

describe("pickNextTasteMatchCandidate", () => {
	test("returns highest-scored row not in exclude set", () => {
		const next = pickNextTasteMatchCandidate(candidates, {
			excludeTmdbIds: new Set([2]),
		});
		expect(next?.tmdbId).toBe(1);
	});

	test("returns null when all candidates excluded", () => {
		const next = pickNextTasteMatchCandidate(candidates, {
			excludeTmdbIds: new Set([1, 2]),
		});
		expect(next).toBeNull();
	});
});
