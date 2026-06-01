import { describe, expect, it } from "bun:test";

import {
	isWatchedDateMonthSelectable,
	isWatchedDateYearSelectable,
	listWatchedDatePickerYears,
} from "./log-watched-date";

describe("listWatchedDatePickerYears", () => {
	it("ends at the max year and includes a reasonable span", () => {
		const years = listWatchedDatePickerYears("2026-06-01");
		expect(years[0]).toBe(2026);
		expect(years.at(-1)).toBeGreaterThanOrEqual(1920);
		expect(years).toContain(2020);
	});
});

describe("isWatchedDateMonthSelectable", () => {
	it("blocks months after today in the current year", () => {
		expect(isWatchedDateMonthSelectable(2026, 5, "2026-06-01")).toBe(true);
		expect(isWatchedDateMonthSelectable(2026, 6, "2026-06-01")).toBe(false);
	});

	it("allows any month in past years", () => {
		expect(isWatchedDateMonthSelectable(2020, 11, "2026-06-01")).toBe(true);
	});
});

describe("isWatchedDateYearSelectable", () => {
	it("rejects future years", () => {
		expect(isWatchedDateYearSelectable(2027, "2026-06-01")).toBe(false);
		expect(isWatchedDateYearSelectable(2026, "2026-06-01")).toBe(true);
	});
});
