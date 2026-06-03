import { describe, expect, test } from "bun:test";
import {
	isValidReviewRatingStored,
	reviewRatingToDisplay,
} from "./review-rating";

describe("reviewRatingToDisplay", () => {
	test("tenths", () => {
		expect(reviewRatingToDisplay(87)).toBe(8.7);
	});
	test("legacy whole", () => {
		expect(reviewRatingToDisplay(9)).toBe(9);
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
