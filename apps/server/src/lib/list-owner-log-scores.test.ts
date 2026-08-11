import { describe, expect, test } from "bun:test";

import { buildOwnerLogScoresFromRows } from "./list-owner-log-scores";

describe("buildOwnerLogScoresFromRows", () => {
	test("keeps latest movie rating", () => {
		const map = buildOwnerLogScoresFromRows([
			{
				movieId: 1,
				tvId: null,
				rating: 90,
				liked: false,
				watchedAt: "2026-02-01T00:00:00.000Z",
			},
			{
				movieId: 1,
				tvId: null,
				rating: 50,
				liked: true,
				watchedAt: "2026-01-01T00:00:00.000Z",
			},
		]);
		expect(map.get("m:1")).toEqual({ rating: 90, liked: false });
	});

	test("resolves TV title score from season ratings and ORs liked", () => {
		const map = buildOwnerLogScoresFromRows([
			{
				movieId: null,
				tvId: 93405,
				rating: 80,
				liked: false,
				watchedAt: "2026-02-01T00:00:00.000Z",
				logScope: "season",
				seasonNumber: 2,
			},
			{
				movieId: null,
				tvId: 93405,
				rating: 100,
				liked: true,
				watchedAt: "2026-01-01T00:00:00.000Z",
				logScope: "season",
				seasonNumber: 1,
			},
		]);
		expect(map.get("t:93405")).toEqual({ rating: 90, liked: true });
	});

	test("lets show-scoped TV rating win", () => {
		const map = buildOwnerLogScoresFromRows([
			{
				movieId: null,
				tvId: 10,
				rating: 70,
				liked: false,
				watchedAt: "2026-02-01T00:00:00.000Z",
				logScope: "show",
				seasonNumber: null,
			},
			{
				movieId: null,
				tvId: 10,
				rating: 40,
				liked: false,
				watchedAt: "2026-01-01T00:00:00.000Z",
				logScope: "season",
				seasonNumber: 1,
			},
		]);
		expect(map.get("t:10")?.rating).toBe(70);
	});
});
