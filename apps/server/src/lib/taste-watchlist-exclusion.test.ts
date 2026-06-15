import { describe, expect, test } from "bun:test";

import { buildTasteMatchExcludeIds } from "./taste-watchlist-exclusion";

describe("buildTasteMatchExcludeIds", () => {
	test("merges logged, dismissed, and watchlist ids without duplicates", () => {
		const excludeIds = buildTasteMatchExcludeIds({
			loggedMovieIds: [1, 2, 3],
			dismissedIds: [3, 4],
			watchlistMovieIds: [4, 5],
		});

		expect(excludeIds.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
	});

	test("returns empty array when all inputs are empty", () => {
		expect(
			buildTasteMatchExcludeIds({
				loggedMovieIds: [],
				dismissedIds: [],
				watchlistMovieIds: [],
			}),
		).toEqual([]);
	});
});
