import { describe, expect, test } from "bun:test";
import { logRatingToDisplay, logRatingToStored } from "./log-rating";

describe("logRatingToStored", () => {
	test("8.7 → 87", () => {
		expect(logRatingToStored(8.7)).toBe(87);
	});
});

describe("logRatingToDisplay", () => {
	test("87 → 8.7", () => {
		expect(logRatingToDisplay(87)).toBe(8.7);
	});
});
