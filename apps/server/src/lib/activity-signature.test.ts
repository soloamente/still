import { describe, expect, test } from "bun:test";

import {
	ACTIVITY_SIGNATURE_WEEKS,
	activityLevelFromCount,
	buildActivitySignature,
	buildActivitySignatureChunk,
	utcDateKeyFromWatchedAt,
	utcWeekStartMonday,
} from "./activity-signature";

describe("activityLevelFromCount", () => {
	test("maps counts to capped levels", () => {
		expect(activityLevelFromCount(0)).toBe(0);
		expect(activityLevelFromCount(1)).toBe(1);
		expect(activityLevelFromCount(4)).toBe(4);
		expect(activityLevelFromCount(99)).toBe(4);
	});
});

describe("buildActivitySignature", () => {
	test("aggregates logs per UTC day inside the window", () => {
		const now = new Date("2026-05-29T15:00:00.000Z");
		const sameDay = "2026-05-28T08:00:00.000Z";
		const payload = buildActivitySignature(
			[sameDay, sameDay, "2026-05-20T12:00:00.000Z"],
			now,
		);
		expect(payload.weeks).toHaveLength(52);
		expect(payload.totalLogs).toBe(3);
		expect(payload.totalDaysActive).toBe(2);
		const may28 = payload.weeks
			.flatMap((w) => w.days)
			.find((d) => d.date === "2026-05-28");
		expect(may28?.count).toBe(2);
		expect(may28?.level).toBe(2);
	});

	test("returns empty stats when no logs in range", () => {
		const payload = buildActivitySignature(
			[],
			new Date("2026-05-29T00:00:00.000Z"),
		);
		expect(payload.totalLogs).toBe(0);
		expect(payload.totalDaysActive).toBe(0);
		expect(
			payload.weeks.flatMap((w) => w.days).every((d) => d.level === 0),
		).toBe(true);
	});

	test("grid spans expected day count", () => {
		const payload = buildActivitySignature(
			["2026-05-29T00:00:00.000Z"],
			new Date("2026-05-29T00:00:00.000Z"),
		);
		const cells = payload.weeks.flatMap((w) => w.days);
		expect(cells.length).toBe(52 * 7);
		const inRange = cells.filter((c) => c.count > 0);
		expect(inRange.length).toBe(1);
	});
});

describe("utcWeekStartMonday", () => {
	test("rolls back to Monday", () => {
		expect(utcWeekStartMonday("2026-05-29")).toBe("2026-05-25");
		expect(utcDateKeyFromWatchedAt(new Date("2026-05-25T12:00:00.000Z"))).toBe(
			"2026-05-25",
		);
	});
});

describe("buildActivitySignatureChunk", () => {
	test("returns requested week count ending before exclusive date", () => {
		const payload = buildActivitySignatureChunk({
			watchedAtValues: ["2026-01-15T12:00:00.000Z", "2025-12-01T12:00:00.000Z"],
			beforeExclusive: "2026-07-01",
			weeks: 26,
			now: new Date("2026-06-30T12:00:00.000Z"),
		});
		expect(payload.weeks).toHaveLength(26);
		expect(payload.rangeEnd).toBe("2026-06-30");
		expect(payload.rangeStart <= "2026-01-15").toBe(true);
		const jan15 = payload.weeks
			.flatMap((w) => w.days)
			.find((d) => d.date === "2026-01-15");
		expect(jan15?.count).toBe(1);
		// Older than this 26-week window — excluded from the chunk grid.
		const dec1 = payload.weeks
			.flatMap((w) => w.days)
			.find((d) => d.date === "2025-12-01");
		expect(dec1).toBeUndefined();
	});

	test("default 52-week chunk matches legacy buildActivitySignature window", () => {
		const now = new Date("2026-05-29T15:00:00.000Z");
		const logs = ["2026-05-28T08:00:00.000Z"];
		const legacy = buildActivitySignature(logs, now);
		const chunked = buildActivitySignatureChunk({
			watchedAtValues: logs,
			weeks: ACTIVITY_SIGNATURE_WEEKS,
			now,
		});
		expect(chunked.weeks).toHaveLength(legacy.weeks.length);
		expect(chunked.totalLogs).toBe(legacy.totalLogs);
	});
});
