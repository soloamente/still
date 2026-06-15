import { describe, expect, test } from "bun:test";
import {
	isValidReviewRatingStored,
	reviewRatingToDisplay,
} from "./review-rating";

describe("reviewRatingToDisplay", () => {
	test("tenths", () => {
		expect(reviewRatingToDisplay(87)).toBe(8.7);
	});

	test("sub-unit", () => {
		expect(reviewRatingToDisplay(8)).toBe(0.8);
	});

	test("migrated legacy whole 9", () => {
		expect(reviewRatingToDisplay(90)).toBe(9);
	});

	test("max", () => {
		expect(reviewRatingToDisplay(100)).toBe(10);
	});
});

describe("isValidReviewRatingStored", () => {
	test("accepts tenths", () => {
		expect(isValidReviewRatingStored(87)).toBe(true);
	});
	test("rejects out of range", () => {
		expect(isValidReviewRatingStored(101)).toBe(false);
	});
});
