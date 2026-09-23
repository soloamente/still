import { describe, expect, test } from "bun:test";

import {
	patronWeekDayMarks,
	startOfPatronWeek,
	summarizeTodayWeekPulse,
} from "./today-week-pulse";

describe("startOfPatronWeek", () => {
	test("Monday 00:00 in America/New_York for a mid-week instant", () => {
		// Wed 2026-09-23 15:00 UTC → Wed in NY (EDT); week starts Mon 2026-09-21
		const now = new Date("2026-09-23T15:00:00.000Z");
		const start = startOfPatronWeek(now, "America/New_York");
		expect(start.toISOString()).toBe("2026-09-21T04:00:00.000Z");
	});

	test("Monday 00:00 UTC for a mid-week instant", () => {
		const now = new Date("2026-09-24T12:00:00.000Z"); // Thu
		const start = startOfPatronWeek(now, "UTC");
		expect(start.toISOString()).toBe("2026-09-21T00:00:00.000Z");
	});

	test("rolls to previous month when Monday spills (UTC)", () => {
		// Tue 2026-09-01 → week starts Mon 2026-08-31
		const now = new Date("2026-09-01T12:00:00.000Z");
		const start = startOfPatronWeek(now, "UTC");
		expect(start.toISOString()).toBe("2026-08-31T00:00:00.000Z");
	});

	test("NY Saturday night still uses Monday-start week containing that day", () => {
		// Sun 2026-09-28 02:00 UTC = Sat Sep 27 22:00 EDT
		const now = new Date("2026-09-28T02:00:00.000Z");
		const start = startOfPatronWeek(now, "America/New_York");
		expect(start.toISOString()).toBe("2026-09-21T04:00:00.000Z");
	});
});

describe("patronWeekDayMarks", () => {
	// Thu 2026-09-24 — ISO week Mon Sep 21 … Sun Sep 27
	const now = new Date("2026-09-24T18:00:00.000Z");

	test("length 7 with Monday-first indices (Mon→Sun)", () => {
		const marks = patronWeekDayMarks([], "UTC", now);
		expect(marks).toHaveLength(7);
	});

	test("marks days with at least one watch in patron TZ", () => {
		const marks = patronWeekDayMarks(
			[
				"2026-09-21T10:00:00.000Z", // Mon UTC
				"2026-09-24T08:00:00.000Z", // Thu UTC
			],
			"UTC",
			now,
		);
		// Mon Tue Wed Thu Fri Sat Sun
		expect(marks).toEqual([true, false, false, true, false, false, false]);
	});

	test("NY vs UTC boundary — late Sunday UTC is still Saturday in NY", () => {
		const marksUtc = patronWeekDayMarks(
			["2026-09-27T03:00:00.000Z"], // Sun 03:00 UTC (in current week)
			"UTC",
			now,
		);
		expect(marksUtc[6]).toBe(true); // Sun slot

		const marksNy = patronWeekDayMarks(
			["2026-09-27T03:00:00.000Z"], // Sat 23:00 EDT
			"America/New_York",
			now,
		);
		expect(marksNy[5]).toBe(true); // Sat slot
		expect(marksNy[6]).toBe(false);
	});

	test("ignores watches outside the current patron week", () => {
		const marks = patronWeekDayMarks(["2026-09-15T12:00:00.000Z"], "UTC", now);
		expect(marks.every((m) => !m)).toBe(true);
	});

	test("defaults now to current instant when omitted", () => {
		const marks = patronWeekDayMarks([], "UTC");
		expect(marks).toHaveLength(7);
	});
});

describe("summarizeTodayWeekPulse", () => {
	// Thu 2026-09-24 — ISO week Mon Sep 21 … Sun Sep 27
	const now = new Date("2026-09-24T18:00:00.000Z");

	test("empty week", () => {
		expect(summarizeTodayWeekPulse([], "UTC", now)).toEqual({
			titlesLogged: 0,
			titlesRated: 0,
			dayMarks: [false, false, false, false, false, false, false],
			empty: true,
		});
	});

	test("counts distinct titles — rewatches and TV episode logs collapse", () => {
		const pulse = summarizeTodayWeekPulse(
			[
				{
					watchedAt: "2026-09-21T10:00:00.000Z",
					rating: null,
					movieId: 1,
					tvId: null,
				},
				{
					watchedAt: "2026-09-22T10:00:00.000Z",
					rating: null,
					movieId: 1,
					tvId: null,
				},
				{
					watchedAt: "2026-09-22T11:00:00.000Z",
					rating: null,
					movieId: null,
					tvId: 9,
				},
				{
					watchedAt: "2026-09-23T11:00:00.000Z",
					rating: null,
					movieId: null,
					tvId: 9,
				},
			],
			"UTC",
			now,
		);
		expect(pulse.titlesLogged).toBe(2);
		expect(pulse.titlesRated).toBe(0);
		expect(pulse.empty).toBe(false);
		expect(pulse.dayMarks).toEqual([
			true,
			true,
			true,
			false,
			false,
			false,
			false,
		]);
	});

	test("a title is rated when any week log has a score — 0 counts as rated", () => {
		const pulse = summarizeTodayWeekPulse(
			[
				{
					watchedAt: "2026-09-21T10:00:00.000Z",
					rating: null,
					movieId: 1,
					tvId: null,
				},
				{
					watchedAt: "2026-09-22T10:00:00.000Z",
					rating: 80,
					movieId: 1,
					tvId: null,
				},
				{
					watchedAt: "2026-09-22T12:00:00.000Z",
					rating: 0,
					movieId: 2,
					tvId: null,
				},
				{
					watchedAt: "2026-09-23T12:00:00.000Z",
					rating: null,
					movieId: 3,
					tvId: null,
				},
			],
			"UTC",
			now,
		);
		expect(pulse.titlesLogged).toBe(3);
		expect(pulse.titlesRated).toBe(2);
	});

	test("ignores logs outside the patron week (Date inputs accepted)", () => {
		const pulse = summarizeTodayWeekPulse(
			[
				{
					watchedAt: new Date("2026-09-15T12:00:00.000Z"),
					rating: 70,
					movieId: 1,
					tvId: null,
				},
			],
			"UTC",
			now,
		);
		expect(pulse.empty).toBe(true);
		expect(pulse.titlesRated).toBe(0);
	});

	test("week boundary follows the patron timezone", () => {
		// Mon 02:00 UTC = Sun Sep 20 22:00 EDT → previous week in New York
		const rows = [
			{
				watchedAt: "2026-09-21T02:00:00.000Z",
				rating: null,
				movieId: 5,
				tvId: null,
			},
		];
		expect(summarizeTodayWeekPulse(rows, "UTC", now).titlesLogged).toBe(1);
		expect(
			summarizeTodayWeekPulse(rows, "America/New_York", now).titlesLogged,
		).toBe(0);
	});
});
