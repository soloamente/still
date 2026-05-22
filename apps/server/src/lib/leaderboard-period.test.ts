import { describe, expect, test } from "bun:test";

import {
	parseLeaderboardPeriod,
	resolveLeaderboardWindow,
} from "./leaderboard-period";

describe("parseLeaderboardPeriod", () => {
	test("accepts known periods", () => {
		expect(parseLeaderboardPeriod("week")).toBe("week");
		expect(parseLeaderboardPeriod("all")).toBe("all");
	});

	test("defaults to month", () => {
		expect(parseLeaderboardPeriod(undefined)).toBe("month");
		expect(parseLeaderboardPeriod("bogus")).toBe("month");
	});
});

describe("resolveLeaderboardWindow", () => {
	test("month boundaries in Europe/Rome", () => {
		const now = new Date("2026-05-15T12:00:00Z");
		const w = resolveLeaderboardWindow("month", "Europe/Rome", now);
		expect(w.start.toISOString()).toBe("2026-04-30T22:00:00.000Z");
		expect(w.end.toISOString()).toBe("2026-05-31T22:00:00.000Z");
	});

	test("week starts Monday in Europe/Rome", () => {
		// 2026-05-15 is Friday; week starts 2026-05-11 (Mon)
		const now = new Date("2026-05-15T12:00:00Z");
		const w = resolveLeaderboardWindow("week", "Europe/Rome", now);
		expect(w.start.toISOString()).toBe("2026-05-10T22:00:00.000Z");
		expect(w.end.toISOString()).toBe("2026-05-17T22:00:00.000Z");
	});

	test("year boundaries UTC", () => {
		const now = new Date("2026-07-04T00:00:00Z");
		const w = resolveLeaderboardWindow("year", "UTC", now);
		expect(w.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
		expect(w.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
	});

	test("all time starts at epoch and ends at now", () => {
		const now = new Date("2026-05-15T12:00:00Z");
		const w = resolveLeaderboardWindow("all", "UTC", now);
		expect(w.start.getTime()).toBe(0);
		expect(w.end.getTime()).toBe(now.getTime());
	});
});
