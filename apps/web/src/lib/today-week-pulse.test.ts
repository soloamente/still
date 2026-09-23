import { describe, expect, test } from "bun:test";

import {
	TODAY_WEEK_DAYS,
	type TodayWeekPulse,
	todayWeekPulseHeadline,
	todayWeekPulseMarksLabel,
} from "./today-week-pulse";

function pulse(overrides: Partial<TodayWeekPulse>): TodayWeekPulse {
	return {
		titlesLogged: 0,
		titlesRated: 0,
		dayMarks: [false, false, false, false, false, false, false],
		empty: true,
		...overrides,
	};
}

describe("todayWeekPulseHeadline", () => {
	test("empty week invites one log", () => {
		expect(todayWeekPulseHeadline(pulse({}))).toBe(
			"Your week starts with one log.",
		);
	});

	test("singular title, no rated segment when nothing rated", () => {
		expect(
			todayWeekPulseHeadline(pulse({ titlesLogged: 1, empty: false })),
		).toBe("1 title logged");
	});

	test("plural titles with rated count", () => {
		expect(
			todayWeekPulseHeadline(
				pulse({ titlesLogged: 2, titlesRated: 1, empty: false }),
			),
		).toBe("2 titles logged · 1 rated");
	});
});

describe("todayWeekPulseMarksLabel", () => {
	test("names the days with a watch", () => {
		expect(
			todayWeekPulseMarksLabel([true, false, false, true, false, false, false]),
		).toBe("Watched on Monday and Thursday");
	});

	test("no watches yet", () => {
		expect(
			todayWeekPulseMarksLabel([
				false,
				false,
				false,
				false,
				false,
				false,
				false,
			]),
		).toBe("No watches yet this week");
	});

	test("seven Monday-first day ids", () => {
		expect(TODAY_WEEK_DAYS.map((d) => d.id)).toEqual([
			"mon",
			"tue",
			"wed",
			"thu",
			"fri",
			"sat",
			"sun",
		]);
	});
});
