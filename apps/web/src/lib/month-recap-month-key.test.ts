import { describe, expect, test } from "bun:test";

import { resolveClientCelebratedMonth } from "./month-recap-month-key";

describe("resolveClientCelebratedMonth", () => {
	test("July visit celebrates June in UTC", () => {
		const result = resolveClientCelebratedMonth(
			new Date("2026-07-02T10:00:00Z"),
			"UTC",
		);
		expect(result.monthKey).toBe("2026-06");
		expect(result.monthLabel).toBe("June 2026");
		expect(result.timeZone).toBe("UTC");
	});

	test("January celebrates prior December", () => {
		const result = resolveClientCelebratedMonth(
			new Date("2026-01-15T12:00:00Z"),
			"UTC",
		);
		expect(result.monthKey).toBe("2025-12");
		expect(result.monthLabel).toBe("December 2025");
	});
});
