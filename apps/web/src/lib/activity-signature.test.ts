import { describe, expect, test } from "bun:test";

import {
	activityDateKeyFromUnknown,
	normalizeActivitySignaturePayload,
} from "./activity-signature";

describe("activityDateKeyFromUnknown", () => {
	test("accepts YYYY-MM-DD strings", () => {
		expect(activityDateKeyFromUnknown("2026-05-25")).toBe("2026-05-25");
	});

	test("coerces Date instances", () => {
		expect(
			activityDateKeyFromUnknown(new Date("2026-05-25T00:00:00.000Z")),
		).toBe("2026-05-25");
	});

	test("coerces ISO strings", () => {
		expect(activityDateKeyFromUnknown("2026-05-25T00:00:00.000Z")).toBe(
			"2026-05-25",
		);
	});
});

describe("normalizeActivitySignaturePayload", () => {
	test("normalizes weekStart when API returns Date objects", () => {
		const payload = normalizeActivitySignaturePayload({
			totalLogs: 1,
			totalDaysActive: 1,
			weeks: [
				{
					weekStart: new Date("2026-05-25T00:00:00.000Z") as unknown as string,
					days: [
						{
							date: new Date("2026-05-25T00:00:00.000Z") as unknown as string,
							count: 1,
							level: 1,
						},
					],
				},
			],
		});
		expect(payload?.weeks[0]?.weekStart).toBe("2026-05-25");
		expect(payload?.weeks[0]?.days[0]?.date).toBe("2026-05-25");
	});
});
