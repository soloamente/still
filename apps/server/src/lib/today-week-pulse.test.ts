import { describe, expect, test } from "bun:test";

import { patronWeekDayMarks, startOfPatronWeek } from "./today-week-pulse";

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
