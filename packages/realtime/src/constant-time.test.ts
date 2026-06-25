import { describe, expect, test } from "bun:test";

import { constantTimeEqual } from "./constant-time";

describe("constantTimeEqual", () => {
	test("returns true for identical strings", () => {
		expect(constantTimeEqual("s3cret-token", "s3cret-token")).toBe(true);
	});

	test("returns false for different same-length strings", () => {
		expect(constantTimeEqual("aaaaaa", "aaaaab")).toBe(false);
	});

	test("returns false for different-length strings", () => {
		expect(constantTimeEqual("short", "longer-value")).toBe(false);
	});

	test("returns true for two empty strings", () => {
		expect(constantTimeEqual("", "")).toBe(true);
	});
});
