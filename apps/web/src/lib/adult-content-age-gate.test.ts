import { describe, expect, test } from "bun:test";

import { patronMeetsAdultAgeGate } from "./adult-content-age-gate";

describe("patronMeetsAdultAgeGate", () => {
	test("rejects under 18", () => {
		expect(
			patronMeetsAdultAgeGate("2010-06-05", new Date("2026-06-05T12:00:00Z")),
		).toBe(false);
	});

	test("accepts exactly 18", () => {
		expect(
			patronMeetsAdultAgeGate("2008-06-05", new Date("2026-06-05T12:00:00Z")),
		).toBe(true);
	});

	test("rejects invalid date", () => {
		expect(patronMeetsAdultAgeGate("not-a-date")).toBe(false);
	});
});
