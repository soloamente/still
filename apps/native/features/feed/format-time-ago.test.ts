import { describe, expect, test } from "bun:test";
import { formatTimeAgo } from "./format-time-ago";

const NOW = new Date("2026-06-04T12:00:00.000Z").getTime();

describe("formatTimeAgo", () => {
	test("seconds → 'just now'", () => {
		expect(formatTimeAgo(new Date(NOW - 10_000).toISOString(), NOW)).toBe(
			"just now",
		);
	});
	test("minutes", () => {
		expect(formatTimeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe(
			"5m",
		);
	});
	test("hours", () => {
		expect(
			formatTimeAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW),
		).toBe("3h");
	});
	test("days", () => {
		expect(
			formatTimeAgo(new Date(NOW - 2 * 86_400_000).toISOString(), NOW),
		).toBe("2d");
	});
	test("weeks", () => {
		expect(
			formatTimeAgo(new Date(NOW - 14 * 86_400_000).toISOString(), NOW),
		).toBe("2w");
	});
	test("future or invalid → 'just now'", () => {
		expect(formatTimeAgo(new Date(NOW + 60_000).toISOString(), NOW)).toBe(
			"just now",
		);
		expect(formatTimeAgo("not-a-date", NOW)).toBe("just now");
	});
});
