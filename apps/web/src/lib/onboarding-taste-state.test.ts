import { describe, expect, test } from "bun:test";

import {
	canAdvanceOnboardingTaste,
	countOnboardingTasteRated,
	isOnboardingTasteSkipped,
} from "./onboarding-taste-state";

describe("countOnboardingTasteRated", () => {
	test("counts only rated titles", () => {
		const ratings = { 1: 80, 2: 70 };
		const skipped = new Set<number>([3]);
		expect(countOnboardingTasteRated(ratings, skipped)).toBe(2);
	});

	test("skipped rated id still counts if in ratings map", () => {
		const ratings = { 1: 80 };
		const skipped = new Set<number>([1]);
		expect(countOnboardingTasteRated(ratings, skipped)).toBe(1);
	});
});

describe("canAdvanceOnboardingTaste", () => {
	test("requires eight ratings by default", () => {
		const ratings = Object.fromEntries(
			Array.from({ length: 7 }, (_, i) => [i + 1, 80]),
		);
		expect(canAdvanceOnboardingTaste(ratings, new Set())).toBe(false);
		expect(
			canAdvanceOnboardingTaste({ ...ratings, 99: 90 }, new Set([1, 2, 3, 4])),
		).toBe(true);
	});
});

describe("isOnboardingTasteSkipped", () => {
	test("reads skip set", () => {
		expect(isOnboardingTasteSkipped(5, new Set([5]))).toBe(true);
		expect(isOnboardingTasteSkipped(5, new Set())).toBe(false);
	});
});
