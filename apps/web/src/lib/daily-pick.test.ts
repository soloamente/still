import { describe, expect, test } from "bun:test";

import {
	DAILY_PICK_POOL,
	djb2,
	formatDayKey,
	pickDailySpotlight,
} from "./daily-pick";

const rankedIds = Array.from({ length: 20 }, (_, index) => index + 1);

describe("pickDailySpotlight", () => {
	test("same inputs return the same id inside the top 12", () => {
		const input = {
			rankedIds,
			dayKey: "2026-10-04",
			userId: "user-1",
			surface: "movie" as const,
			skippedIds: [],
			pinnedId: null,
		};
		const id = pickDailySpotlight(input);
		expect(id).toBe(pickDailySpotlight(input));
		expect(rankedIds.slice(0, DAILY_PICK_POOL)).toContain(id);
	});

	test("a different dayKey can choose a different id", () => {
		const base = {
			rankedIds,
			userId: "user-1",
			surface: "movie" as const,
			skippedIds: [],
			pinnedId: null,
		};
		const ids = new Set(
			["2026-10-04", "2026-10-05", "2026-11-01", "2027-01-01"].map((dayKey) =>
				pickDailySpotlight({ ...base, dayKey }),
			),
		);
		expect(ids.size).toBeGreaterThan(1);
	});

	test("skipped ids are walked past and a pin wins while eligible", () => {
		const first = pickDailySpotlight({
			rankedIds,
			dayKey: "2026-10-04",
			userId: "user-1",
			surface: "tv",
			skippedIds: [],
			pinnedId: null,
		});
		expect(first).not.toBeNull();
		const next = pickDailySpotlight({
			rankedIds,
			dayKey: "2026-10-04",
			userId: "user-1",
			surface: "tv",
			skippedIds: [first ?? 0],
			pinnedId: null,
		});
		expect(next).not.toBe(first);
		expect(
			pickDailySpotlight({
				rankedIds,
				dayKey: "2026-10-04",
				userId: "user-1",
				surface: "tv",
				skippedIds: [],
				pinnedId: 3,
			}),
		).toBe(3);
	});

	test("a pin absent from the pool does not return", () => {
		expect(
			pickDailySpotlight({
				rankedIds,
				dayKey: "2026-10-04",
				userId: "user-1",
				surface: "watchlist",
				skippedIds: [],
				pinnedId: 99,
			}),
		).not.toBe(99);
	});

	test("djb2 is an unsigned 32-bit integer", () => {
		expect(djb2("user-1:2026-10-04:movie")).toBeGreaterThanOrEqual(0);
		expect(djb2("user-1:2026-10-04:movie")).toBeLessThan(2 ** 32);
	});

	test("formatDayKey uses the timezone calendar date", () => {
		const instant = new Date("2026-10-04T23:30:00.000Z");
		expect(formatDayKey("UTC", instant)).toBe("2026-10-04");
		expect(formatDayKey("Pacific/Kiritimati", instant)).toBe("2026-10-05");
	});
});
