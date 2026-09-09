import { describe, expect, test } from "bun:test";

import { timingSafeEqual } from "./auth";

describe("timingSafeEqual", () => {
	test("equal strings", () => {
		expect(timingSafeEqual("abc", "abc")).toBe(true);
	});

	test("different strings same length", () => {
		expect(timingSafeEqual("abc", "abd")).toBe(false);
	});

	test("different lengths", () => {
		expect(timingSafeEqual("ab", "abc")).toBe(false);
	});
});
