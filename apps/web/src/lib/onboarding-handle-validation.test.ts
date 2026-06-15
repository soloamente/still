import { describe, expect, test } from "bun:test";

import {
	isOwnSavedHandle,
	normalizeHandleInput,
	validateHandle,
} from "./onboarding-handle";

describe("validateHandle", () => {
	test("accepts valid handles", () => {
		expect(validateHandle("anselmo")).toEqual({ ok: true });
		expect(validateHandle("a.b_2")).toEqual({ ok: true });
	});

	test("rejects too short", () => {
		expect(validateHandle("a")).toEqual({
			ok: false,
			reason: "format",
		});
	});

	test("normalizes uppercase to valid handle", () => {
		expect(validateHandle("Anselmo")).toEqual({ ok: true });
	});

	test("rejects invalid characters", () => {
		expect(validateHandle("bad!name")).toEqual({
			ok: false,
			reason: "format",
		});
		expect(validateHandle("")).toEqual({
			ok: false,
			reason: "format",
		});
	});
});

describe("normalizeHandleInput", () => {
	test("lowercases and strips spaces", () => {
		expect(normalizeHandleInput("  Anselmo.Cinema  ")).toBe("anselmo.cinema");
	});
});

describe("isOwnSavedHandle", () => {
	test("matches the patron's saved handle", () => {
		expect(isOwnSavedHandle("alessandro", "alessandro")).toBe(true);
		expect(isOwnSavedHandle("Alessandro", "alessandro")).toBe(true);
	});

	test("returns false for a different handle", () => {
		expect(isOwnSavedHandle("alessandro", "other")).toBe(false);
	});
});
