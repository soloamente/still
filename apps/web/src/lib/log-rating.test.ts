import { describe, expect, test } from "bun:test";
import {
	formatLogRatingDisplay,
	formatStoredLogRatingDisplay,
	logRatingToDisplay,
	logRatingToStored,
} from "./log-rating";

describe("logRatingToStored", () => {
	test("8.7 → 87", () => {
		expect(logRatingToStored(8.7)).toBe(87);
	});

	test("0.8 → 8 (sub‑1.0 tenths)", () => {
		expect(logRatingToStored(0.8)).toBe(8);
	});

	test("1.0 → 10", () => {
		expect(logRatingToStored(1.0)).toBe(10);
	});

	test("10 → 100", () => {
		expect(logRatingToStored(10)).toBe(100);
	});
});

describe("logRatingToDisplay", () => {
	test("87 → 8.7", () => {
		expect(logRatingToDisplay(87)).toBe(8.7);
	});

	test("8 → 0.8 (sub‑1.0 tenths)", () => {
		expect(logRatingToDisplay(8)).toBe(0.8);
	});

	test("10 → 1.0", () => {
		expect(logRatingToDisplay(10)).toBe(1.0);
	});

	test("80 → 8.0 (migrated legacy whole 8)", () => {
		expect(logRatingToDisplay(80)).toBe(8);
	});

	test("100 → 10", () => {
		expect(logRatingToDisplay(100)).toBe(10);
	});
});

describe("logRating round-trip", () => {
	test("0.8 survives store → display", () => {
		const stored = logRatingToStored(0.8);
		expect(stored).toBe(8);
		expect(logRatingToDisplay(stored)).toBe(0.8);
	});

	test("1.1 survives store → display", () => {
		const stored = logRatingToStored(1.1);
		expect(stored).toBe(11);
		expect(logRatingToDisplay(stored)).toBe(1.1);
	});
});

describe("formatLogRatingDisplay", () => {
	test("8.7 display → 8.7", () => {
		expect(formatLogRatingDisplay(8.7)).toBe("8.7");
	});

	test("10 display → 10 (not 10.0)", () => {
		expect(formatLogRatingDisplay(10)).toBe("10");
	});

	test("0 display → 0.0", () => {
		expect(formatLogRatingDisplay(0)).toBe("0.0");
	});
});

describe("formatStoredLogRatingDisplay", () => {
	test("87 stored → 8.7", () => {
		expect(formatStoredLogRatingDisplay(87)).toBe("8.7");
	});
});
