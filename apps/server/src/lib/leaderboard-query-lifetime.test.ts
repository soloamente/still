import { describe, expect, test } from "bun:test";

import {
	buildLifetimeWatchIndexMap,
	mergeLifetimeWatchCounts,
} from "./leaderboard-query";

describe("buildLifetimeWatchIndexMap", () => {
	test("assigns all-time watch ordinals per title", () => {
		const map = buildLifetimeWatchIndexMap([
			{
				logId: "early-period",
				watchedAt: "2026-01-01T00:00:00.000Z",
				movieId: 99,
				tvId: null,
			},
			{
				logId: "before-period",
				watchedAt: "2025-06-01T00:00:00.000Z",
				movieId: 99,
				tvId: null,
			},
			{
				logId: "late-period",
				watchedAt: "2026-02-01T00:00:00.000Z",
				movieId: 99,
				tvId: null,
			},
		]);

		expect(map.get("before-period")).toEqual({
			watchIndexLifetime: 1,
			watchCountLifetime: 3,
		});
		expect(map.get("early-period")).toEqual({
			watchIndexLifetime: 2,
			watchCountLifetime: 3,
		});
		expect(map.get("late-period")).toEqual({
			watchIndexLifetime: 3,
			watchCountLifetime: 3,
		});
	});
});

describe("mergeLifetimeWatchCounts", () => {
	test("overlays lifetime fields onto period-annotated rows", () => {
		const merged = mergeLifetimeWatchCounts(
			[
				{
					logId: "a",
					watchedAt: "2026-02-01T00:00:00.000Z",
					movieId: 1,
					tvId: null,
					title: "Film",
					posterPath: null,
					rating: null,
					rewatch: true,
					watchIndexInPeriod: 2,
					watchCountInPeriod: 2,
					watchIndexLifetime: 1,
					watchCountLifetime: 1,
				},
			],
			new Map([["a", { watchIndexLifetime: 5, watchCountLifetime: 5 }]]),
		);

		expect(merged[0]?.watchIndexLifetime).toBe(5);
		expect(merged[0]?.watchCountLifetime).toBe(5);
		expect(merged[0]?.watchIndexInPeriod).toBe(2);
	});
});
