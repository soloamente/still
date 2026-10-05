import { describe, expect, test } from "vitest";

import type { MyTvLog } from "@/lib/my-tv-log";

import {
	countTvLogsInScope,
	findLatestTvLogInScope,
	seriesReadyForShowDiary,
	tvLogMatchesScope,
} from "./tv-log-scope-prior";

const s1: MyTvLog = {
	id: "1",
	liked: false,
	logScope: "season",
	seasonNumber: 1,
};
const s2: MyTvLog = {
	id: "2",
	liked: false,
	logScope: "season",
	seasonNumber: 2,
};
const show: MyTvLog = {
	id: "3",
	liked: false,
	logScope: "show",
};
const legacyShow: MyTvLog = {
	id: "4",
	liked: false,
	logScope: null,
};

describe("tvLogMatchesScope", () => {
	test("season 2 does not match season 1 log", () => {
		expect(tvLogMatchesScope(s1, { logScope: "season", seasonNumber: 2 })).toBe(
			false,
		);
	});

	test("legacy null scope counts as show", () => {
		expect(tvLogMatchesScope(legacyShow, { logScope: "show" })).toBe(true);
		expect(
			tvLogMatchesScope(legacyShow, { logScope: "season", seasonNumber: 1 }),
		).toBe(false);
	});
});

describe("countTvLogsInScope", () => {
	test("show scope ignores season logs", () => {
		expect(countTvLogsInScope([s1, s2, show], { logScope: "show" })).toBe(1);
	});

	test("season scope is isolated", () => {
		const logs = [s1, s2];
		expect(
			countTvLogsInScope(logs, { logScope: "season", seasonNumber: 1 }),
		).toBe(1);
		expect(
			countTvLogsInScope(logs, { logScope: "season", seasonNumber: 2 }),
		).toBe(1);
	});
});

describe("seriesReadyForShowDiary", () => {
	const seasons = [
		{ season_number: 1, episode_count: 8 },
		{ season_number: 2, episode_count: 10 },
	];

	test("ready when finished and every season is already in the diary", () => {
		expect(
			seriesReadyForShowDiary({
				status: "finished",
				seasons,
				logs: [s1, s2],
			}),
		).toBe(true);
	});

	test("skips when a show log already exists", () => {
		expect(
			seriesReadyForShowDiary({
				status: "finished",
				seasons,
				logs: [s1, s2, show],
			}),
		).toBe(false);
	});

	test("skips while a season diary row is still missing", () => {
		expect(
			seriesReadyForShowDiary({
				status: "finished",
				seasons,
				logs: [s1],
			}),
		).toBe(false);
	});

	test("skips until the series is finished", () => {
		expect(
			seriesReadyForShowDiary({
				status: "watching",
				seasons,
				logs: [s1, s2],
			}),
		).toBe(false);
	});
});

describe("findLatestTvLogInScope", () => {
	test("returns first matching row in newest-first list", () => {
		const logs = [s2, s1];
		expect(
			findLatestTvLogInScope(logs, { logScope: "season", seasonNumber: 1 })?.id,
		).toBe("1");
	});
});
