import { describe, expect, test } from "bun:test";

import { normalizeProfileSearchQuery } from "./profile-search-query";

describe("normalizeProfileSearchQuery", () => {
	test("strips leading @", () => {
		expect(normalizeProfileSearchQuery("@ada")).toBe("ada");
		expect(normalizeProfileSearchQuery("@@ada")).toBe("ada");
	});

	test("trims whitespace", () => {
		expect(normalizeProfileSearchQuery("  ada  ")).toBe("ada");
	});

	test("returns empty for whitespace-only", () => {
		expect(normalizeProfileSearchQuery("   ")).toBe("");
		expect(normalizeProfileSearchQuery("@")).toBe("");
	});
});
