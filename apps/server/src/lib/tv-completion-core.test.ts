import { describe, expect, test } from "bun:test";

import {
	completedSeasonNumbers,
	latestWatchedAt,
	planCompletionLogs,
} from "./tv-completion-core";

const season = (seasonNumber: number, count: number) => ({
	seasonNumber,
	episodeNumbers: Array.from({ length: count }, (_, i) => i + 1),
});

const watchedAll = (seasonNumber: number, count: number) =>
	Array.from({ length: count }, (_, i) => ({
		seasonNumber,
		episodeNumber: i + 1,
	}));

describe("completedSeasonNumbers", () => {
	test("a partly watched season is not complete", () => {
		expect(completedSeasonNumbers([season(1, 3)], watchedAll(1, 2))).toEqual(
			[],
		);
	});

	test("a fully watched season is complete", () => {
		expect(
			completedSeasonNumbers([season(1, 3), season(2, 2)], watchedAll(1, 3)),
		).toEqual([1]);
	});

	test("a season with no episodes is never complete", () => {
		expect(completedSeasonNumbers([season(1, 0)], [])).toEqual([]);
	});
});

describe("planCompletionLogs", () => {
	test("creates a season log when the last episode completes the season", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2), season(2, 2)],
			watched: watchedAll(1, 2),
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [1], showLogToCreate: false });
	});

	test("does not duplicate an existing season log", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2)],
			watched: watchedAll(1, 2),
			seasonsWithLog: new Set([1]),
			hasShowLog: false,
		});
		expect(plan.seasonLogsToCreate).toEqual([]);
		// Season 1 is the only season and it is done -> series is complete.
		expect(plan.showLogToCreate).toBe(true);
	});

	test("creates the whole-show log once every season is complete", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2), season(2, 1)],
			watched: [...watchedAll(1, 2), ...watchedAll(2, 1)],
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({
			seasonLogsToCreate: [1, 2],
			showLogToCreate: true,
		});
	});

	test("does not recreate an existing whole-show log", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 1)],
			watched: watchedAll(1, 1),
			seasonsWithLog: new Set([1]),
			hasShowLog: true,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [], showLogToCreate: false });
	});

	test("a season finished by a diary log (no check-marks) still counts toward the series", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 2), season(2, 2)],
			watched: watchedAll(2, 2),
			seasonsWithLog: new Set([1]),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [2], showLogToCreate: true });
	});

	test("an unwatched later season blocks the whole-show log", () => {
		const plan = planCompletionLogs({
			seasons: [season(1, 1), season(2, 1)],
			watched: watchedAll(1, 1),
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan.showLogToCreate).toBe(false);
	});

	test("specials (season 0) never block or trigger completion", () => {
		const plan = planCompletionLogs({
			seasons: [season(0, 3), season(1, 1)],
			watched: watchedAll(1, 1),
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [1], showLogToCreate: true });
	});

	test("no catalogue means nothing to create", () => {
		const plan = planCompletionLogs({
			seasons: [],
			watched: [],
			seasonsWithLog: new Set(),
			hasShowLog: false,
		});
		expect(plan).toEqual({ seasonLogsToCreate: [], showLogToCreate: false });
	});
});

describe("latestWatchedAt", () => {
	const early = new Date("2026-01-01T00:00:00.000Z");
	const late = new Date("2026-03-01T00:00:00.000Z");
	const rows = [
		{ seasonNumber: 1, episodeNumber: 1, watchedAt: early },
		{ seasonNumber: 1, episodeNumber: 2, watchedAt: late },
		{ seasonNumber: 2, episodeNumber: 1, watchedAt: early },
	];

	test("latest within one season", () => {
		expect(latestWatchedAt(rows, 2)).toEqual(early);
		expect(latestWatchedAt(rows, 1)).toEqual(late);
	});

	test("latest across the whole show", () => {
		expect(latestWatchedAt(rows)).toEqual(late);
	});

	test("null when no row has a date", () => {
		expect(latestWatchedAt([{ seasonNumber: 1, episodeNumber: 1 }])).toBeNull();
	});
});
