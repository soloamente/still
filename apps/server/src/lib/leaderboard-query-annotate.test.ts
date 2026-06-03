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
});
