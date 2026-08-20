import { describe, expect, test } from "bun:test";

import { readCssNumber, sampleCubicBezier } from "./input-clear-dissolve";

describe("sampleCubicBezier", () => {
	test("returns identity when the string is not a cubic-bezier", () => {
		const ease = sampleCubicBezier("ease-out");
		expect(ease(0)).toBe(0);
		expect(ease(0.5)).toBe(0.5);
		expect(ease(1)).toBe(1);
	});

	test("samples smooth-out endpoints and a mid progress point", () => {
		const ease = sampleCubicBezier("cubic-bezier(0.22, 1, 0.36, 1)");
		expect(ease(0)).toBe(0);
		expect(ease(1)).toBe(1);
		const mid = ease(0.5);
		expect(mid).toBeGreaterThan(0.5);
		expect(mid).toBeLessThanOrEqual(1);
	});
});

describe("readCssNumber", () => {
	test("falls back when document is unavailable or var missing", () => {
		expect(readCssNumber("--definitely-missing-clear-var", 42)).toBe(42);
	});
});
