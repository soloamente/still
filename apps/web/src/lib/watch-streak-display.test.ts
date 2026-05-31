import { describe, expect, test } from "bun:test";

import {
	watchStreakLabel,
	watchStreakStatusLine,
} from "@/lib/watch-streak-display";
import type { WatchStreakSnapshot } from "@/lib/watch-streak-types";

function snapshot(
	overrides: Partial<WatchStreakSnapshot> = {},
): WatchStreakSnapshot {
	return {
		currentStreak: 4,
		longestStreak: 10,
		lastActiveDay: "2026-05-28",
		shieldsRemaining: 2,
		autoGraceAvailable: false,
		freezeCoversDay: null,
		status: "active",
		todayDay: "2026-05-29",
		...overrides,
	};
}

describe("watchStreakLabel", () => {
	test("formats zero, one, and plural", () => {
		expect(watchStreakLabel(0)).toBe("Diary streak");
		expect(watchStreakLabel(1)).toBe("1-day streak");
		expect(watchStreakLabel(4)).toBe("4-day streak");
	});
});

describe("watchStreakStatusLine", () => {
	test("idle copy when no logs yet", () => {
		expect(watchStreakStatusLine(snapshot({ currentStreak: 0 }), false)).toBe(
			"Log a film today to start",
		);
	});

	test("at-risk and shield-covered states", () => {
		expect(
			watchStreakStatusLine(
				snapshot({ status: "at_risk", currentStreak: 4 }),
				true,
			),
		).toBe("Log today to keep it");
		expect(
			watchStreakStatusLine(
				snapshot({
					freezeCoversDay: "2026-05-29",
					todayDay: "2026-05-29",
				}),
				true,
			),
		).toBe("Shield active today");
	});
});
