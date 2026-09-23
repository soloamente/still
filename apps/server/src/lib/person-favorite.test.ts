import { describe, expect, test } from "bun:test";

import {
	buildPersonFavoriteCreditBaseline,
	collectPersonCreditsFromTmdb,
} from "./person-favorite";

describe("buildPersonFavoriteCreditBaseline", () => {
	test("maps credits to seen rows with role keys and no notify flag", () => {
		const rows = buildPersonFavoriteCreditBaseline([
			{
				mediaKind: "movie",
				tmdbId: 10,
				role: { kind: "cast", character: "Paul Atreides" },
			},
			{
				mediaKind: "movie",
				tmdbId: 10,
				role: { kind: "crew", job: "Director" },
			},
			{
				mediaKind: "tv",
				tmdbId: 20,
				role: { kind: "crew", job: "Writer" },
			},
		]);
		expect(rows).toEqual([
			{ mediaKind: "movie", tmdbId: 10, roleKey: "cast:paul atreides" },
			{ mediaKind: "movie", tmdbId: 10, roleKey: "crew:director" },
			{ mediaKind: "tv", tmdbId: 20, roleKey: "crew:writer" },
		]);
	});

	test("dedupes identical mediaKind+tmdbId+roleKey", () => {
		const rows = buildPersonFavoriteCreditBaseline([
			{
				mediaKind: "movie",
				tmdbId: 1,
				role: { kind: "cast", character: "Ada" },
			},
			{
				mediaKind: "movie",
				tmdbId: 1,
				role: { kind: "cast", character: "Ada" },
			},
		]);
		expect(rows).toEqual([
			{ mediaKind: "movie", tmdbId: 1, roleKey: "cast:ada" },
		]);
	});

	test("skips invalid title ids", () => {
		expect(
			buildPersonFavoriteCreditBaseline([
				{
					mediaKind: "movie",
					tmdbId: 0,
					role: { kind: "cast", character: "X" },
				},
				{
					mediaKind: "tv",
					tmdbId: Number.NaN,
					role: { kind: "crew", job: "Editor" },
				},
			]),
		).toEqual([]);
	});
});

describe("collectPersonCreditsFromTmdb", () => {
	test("flattens movie/tv cast and crew", () => {
		const credits = collectPersonCreditsFromTmdb({
			movie_credits: {
				cast: [{ id: 1, character: "Hero" } as never],
				crew: [{ id: 2, job: "Director" } as never],
			},
			tv_credits: {
				cast: [{ id: 3, character: "Guest" } as never],
				crew: [{ id: 4, job: "Writer" } as never],
			},
		});
		expect(credits).toEqual([
			{
				mediaKind: "movie",
				tmdbId: 1,
				role: { kind: "cast", character: "Hero" },
			},
			{
				mediaKind: "movie",
				tmdbId: 2,
				role: { kind: "crew", job: "Director" },
			},
			{
				mediaKind: "tv",
				tmdbId: 3,
				role: { kind: "cast", character: "Guest" },
			},
			{
				mediaKind: "tv",
				tmdbId: 4,
				role: { kind: "crew", job: "Writer" },
			},
		]);
	});
});
