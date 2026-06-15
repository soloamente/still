import { describe, expect, test } from "bun:test";

import {
	buildCsv,
	csvEscape,
	displayTenToLetterboxdStars,
	exportDateKey,
	formatRatingTenDisplay,
	storedRatingToDisplayTen,
} from "./me-export-csv";

describe("csvEscape", () => {
	test("passes plain values through", () => {
		expect(csvEscape("Whiplash")).toBe("Whiplash");
		expect(csvEscape(2014)).toBe("2014");
	});
	test("empty for null/undefined", () => {
		expect(csvEscape(null)).toBe("");
		expect(csvEscape(undefined)).toBe("");
	});
	test("quotes commas, quotes, and newlines", () => {
		expect(csvEscape("I, Tonya")).toBe('"I, Tonya"');
		expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
		expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
	});
});

describe("buildCsv", () => {
	test("joins header + rows with trailing newline", () => {
		const csv = buildCsv(
			["Date", "Name", "Year"],
			[
				["2026-01-06", "Whiplash", 2014],
				["2026-01-07", "I, Tonya", 2017],
			],
		);
		expect(csv).toBe(
			'Date,Name,Year\n2026-01-06,Whiplash,2014\n2026-01-07,"I, Tonya",2017\n',
		);
	});
});

describe("rating conversions", () => {
	test("stored tenths normalize to 0–10 display", () => {
		expect(storedRatingToDisplayTen(72)).toBe(7.2);
		expect(storedRatingToDisplayTen(100)).toBe(10);
	});
	test("sub-unit tenths normalize to 0–10 display", () => {
		expect(storedRatingToDisplayTen(8)).toBe(0.8);
		expect(storedRatingToDisplayTen(10)).toBe(1);
	});
	test("migrated legacy whole scores use tenths band", () => {
		expect(storedRatingToDisplayTen(70)).toBe(7);
		expect(storedRatingToDisplayTen(100)).toBe(10);
	});
	test("display 0–10 maps to Letterboxd half-stars", () => {
		expect(displayTenToLetterboxdStars(7.2)).toBe(3.5);
		expect(displayTenToLetterboxdStars(7.5)).toBe(4);
		expect(displayTenToLetterboxdStars(10)).toBe(5);
		expect(displayTenToLetterboxdStars(0.4)).toBe(0.5);
	});
	test("Rating10 column shows one decimal except whole 10", () => {
		expect(formatRatingTenDisplay(7.2)).toBe("7.2");
		expect(formatRatingTenDisplay(10)).toBe("10");
		expect(formatRatingTenDisplay(7)).toBe("7.0");
	});
});

describe("exportDateKey", () => {
	test("UTC YYYY-MM-DD", () => {
		expect(exportDateKey(new Date("2026-01-06T23:30:00Z"))).toBe("2026-01-06");
	});
	test("accepts ISO strings", () => {
		expect(exportDateKey("2026-01-06T01:00:00.000Z")).toBe("2026-01-06");
	});
	test("empty for null", () => {
		expect(exportDateKey(null)).toBe("");
	});
});
