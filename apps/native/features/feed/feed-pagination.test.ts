import { describe, expect, test } from "bun:test";
import type { ActivityItem } from "./activity-feed-types";
import {
	FEED_PAGE_SIZE,
	getDeviceTimeZone,
	nextBeforeCursor,
} from "./feed-pagination";

function page(n: number): ActivityItem[] {
	return Array.from({ length: n }, (_, i) => ({
		kind: "log" as const,
		at: `2026-06-04T${String(10 + i).padStart(2, "0")}:00:00.000Z`,
		payload: {},
	}));
}

describe("nextBeforeCursor", () => {
	test("full page → last item's `at`", () => {
		const full = page(FEED_PAGE_SIZE);
		expect(nextBeforeCursor(full)).toBe(full[full.length - 1].at);
	});
	test("partial page → undefined (end of feed)", () => {
		expect(nextBeforeCursor(page(3))).toBeUndefined();
	});
	test("empty page → undefined", () => {
		expect(nextBeforeCursor([])).toBeUndefined();
	});
});

describe("getDeviceTimeZone", () => {
	test("returns a non-empty string", () => {
		expect(getDeviceTimeZone().length).toBeGreaterThan(0);
	});
});
