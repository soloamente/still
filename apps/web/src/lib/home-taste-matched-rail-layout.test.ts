import { describe, expect, test } from "bun:test";

import { tasteRailVisibleCount } from "./home-taste-matched-rail-layout";

describe("tasteRailVisibleCount", () => {
	test("fits more slots as the track grows", () => {
		expect(tasteRailVisibleCount(400)).toBe(3);
		expect(tasteRailVisibleCount(900)).toBe(7);
		expect(tasteRailVisibleCount(2400)).toBeGreaterThan(12);
	});

	test("never returns fewer than three", () => {
		expect(tasteRailVisibleCount(0)).toBe(3);
	});
});
