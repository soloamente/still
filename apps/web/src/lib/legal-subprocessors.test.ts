import { describe, expect, test } from "bun:test";

import { LEGAL_SUBPROCESSORS } from "./legal-subprocessors";

describe("legal-subprocessors", () => {
	test("lists named vendors with a purpose each", () => {
		expect(LEGAL_SUBPROCESSORS.length).toBeGreaterThanOrEqual(5);
		for (const row of LEGAL_SUBPROCESSORS) {
			expect(row.name.length).toBeGreaterThan(0);
			expect(row.purpose.length).toBeGreaterThan(0);
			expect(row.purpose.includes("—")).toBe(false);
		}
	});
});
