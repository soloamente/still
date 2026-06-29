import { describe, expect, test } from "bun:test";

import { clampHiddenCount } from "./leaderboard-hidden-count";

describe("clampHiddenCount", () => {
	test("returns the remainder hidden from a non-owner viewer", () => {
		expect(clampHiddenCount(50, 38)).toBe(12);
	});

	test("is zero when the viewer sees everything (owner)", () => {
		expect(clampHiddenCount(24, 24)).toBe(0);
	});

	test("never goes negative even if visible exceeds total", () => {
		expect(clampHiddenCount(5, 9)).toBe(0);
	});
});
