import { describe, expect, test } from "bun:test";

import { annotateLeaderboardLogItems } from "./leaderboard-query";

describe("annotateLeaderboardLogItems", () => {
	test("assigns watch ordinals per title within the period", () => {
		const annotated = annotateLeaderboardLogItems([
			{
				logId: "b",
				watchedAt: "2026-02-01T00:00:00.000Z",
				movieId: 99,
				tvId: null,
				title: "Repeat",
				posterPath: null,
				rating: 80,
				rewatch: true,
			},
			{
				logId: "a",
				watchedAt: "2026-01-01T00:00:00.000Z",
				movieId: 99,
				tvId: null,
				title: "Repeat",
				posterPath: null,
				rating: 70,
				rewatch: false,
			},
		]);

		const first = annotated.find((row) => row.logId === "a");
		const second = annotated.find((row) => row.logId === "b");
		expect(first?.watchIndexInPeriod).toBe(1);
		expect(first?.watchCountInPeriod).toBe(2);
		expect(second?.watchIndexInPeriod).toBe(2);
		expect(second?.watchCountInPeriod).toBe(2);
		expect(second?.rewatch).toBe(true);
	});

	test("does not treat different seasons of the same show as rewatches", () => {
		const annotated = annotateLeaderboardLogItems([
			{
				logId: "s1",
				watchedAt: "2026-01-05T00:00:00.000Z",
				movieId: null,
				tvId: 93405,
				title: "Squid Game",
				posterPath: null,
				rating: null,
				rewatch: false,
				logScope: "season",
				seasonNumber: 1,
				episodeWeight: 9,
			},
			{
				logId: "s2",
				watchedAt: "2026-01-20T00:00:00.000Z",
				movieId: null,
				tvId: 93405,
				title: "Squid Game",
				posterPath: null,
				rating: null,
				rewatch: false,
				logScope: "season",
				seasonNumber: 2,
				episodeWeight: 7,
			},
		]);

		expect(annotated.find((r) => r.logId === "s1")?.watchCountInPeriod).toBe(1);
		expect(annotated.find((r) => r.logId === "s2")?.watchCountInPeriod).toBe(1);
		expect(annotated.find((r) => r.logId === "s1")?.watchIndexInPeriod).toBe(1);
		expect(annotated.find((r) => r.logId === "s2")?.watchIndexInPeriod).toBe(1);
	});

	test("still groups true season rewatches together", () => {
		const annotated = annotateLeaderboardLogItems([
			{
				logId: "s2a",
				watchedAt: "2026-01-05T00:00:00.000Z",
				movieId: null,
				tvId: 93405,
				title: "Squid Game",
				posterPath: null,
				rating: null,
				rewatch: false,
				logScope: "season",
				seasonNumber: 2,
			},
			{
				logId: "s2b",
				watchedAt: "2026-01-20T00:00:00.000Z",
				movieId: null,
				tvId: 93405,
				title: "Squid Game",
				posterPath: null,
				rating: null,
				rewatch: true,
				logScope: "season",
				seasonNumber: 2,
			},
		]);

		expect(annotated.find((r) => r.logId === "s2a")?.watchCountInPeriod).toBe(
			2,
		);
		expect(annotated.find((r) => r.logId === "s2b")?.watchIndexInPeriod).toBe(
			2,
		);
	});
});
