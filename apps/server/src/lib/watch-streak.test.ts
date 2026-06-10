import { describe, expect, test } from "bun:test";

import {
	applyQualifyingDay,
	applyStreakShield,
	computeLivingStreakFromDayKeys,
	computeStreakFromDayKeys,
	deriveStreakStatus,
	toUtcDayKey,
} from "./watch-streak";

describe("watch-streak", () => {
	test("consecutive days increment streak", () => {
		let s = computeStreakFromDayKeys([]);
		s = applyQualifyingDay(s, "2026-05-01");
		s = applyQualifyingDay(s, "2026-05-02");
		s = applyQualifyingDay(s, "2026-05-03");
		expect(s.currentStreak).toBe(3);
		expect(s.lastActiveDay).toBe("2026-05-03");
	});

	test("auto-grace bridges one skipped day once", () => {
		let s = computeStreakFromDayKeys(["2026-05-01", "2026-05-02"]);
		expect(s.autoGraceAvailable).toBe(true);
		s = applyQualifyingDay(s, "2026-05-04");
		expect(s.currentStreak).toBe(3);
		expect(s.autoGraceAvailable).toBe(false);
		s = applyQualifyingDay(s, "2026-05-06");
		expect(s.currentStreak).toBe(1);
	});

	test("at_risk when last log was yesterday", () => {
		const s = computeStreakFromDayKeys(["2026-05-27", "2026-05-28"]);
		const status = deriveStreakStatus(s, new Date("2026-05-29T15:00:00.000Z"));
		expect(status).toBe("at_risk");
	});

	test("shield protects today while at risk", () => {
		const base = computeStreakFromDayKeys(["2026-05-27", "2026-05-28"]);
		const now = new Date("2026-05-29T10:00:00.000Z");
		const applied = applyStreakShield(base, now);
		expect(applied.ok).toBe(true);
		if (!applied.ok) return;
		expect(applied.next.shieldsRemaining).toBe(1);
		expect(applied.next.freezeCoversDay).toBe("2026-05-29");
		expect(deriveStreakStatus(applied.next, now)).toBe("active");
	});

	test("same-day logs do not double-count", () => {
		let s = computeStreakFromDayKeys(["2026-05-01"]);
		s = applyQualifyingDay(s, "2026-05-01");
		expect(s.currentStreak).toBe(1);
	});

	test("toUtcDayKey uses UTC boundary", () => {
		expect(toUtcDayKey(new Date("2026-05-01T23:30:00.000Z"))).toBe(
			"2026-05-01",
		);
		expect(toUtcDayKey(new Date("2026-05-02T00:30:00.000Z"))).toBe(
			"2026-05-02",
		);
	});

	test("living streak counts consecutive days ending on latest log", () => {
		const dayKeys: string[] = [];
		for (let i = 0; i < 90; i += 1) {
			const d = new Date("2026-03-12T12:00:00.000Z");
			d.setUTCDate(d.getUTCDate() + i);
			dayKeys.push(toUtcDayKey(d));
		}
		const streak = computeLivingStreakFromDayKeys(dayKeys);
		expect(streak.currentStreak).toBe(90);
		expect(streak.lastActiveDay).toBe("2026-06-09");
	});

	test("living streak breaks on the first gap before the latest log", () => {
		const streak = computeLivingStreakFromDayKeys([
			"2026-06-01",
			"2026-06-02",
			"2026-06-03",
			"2026-06-10",
			"2026-06-11",
			"2026-06-12",
		]);
		expect(streak.currentStreak).toBe(3);
		expect(streak.lastActiveDay).toBe("2026-06-12");
	});

	test("backdated logs do not rewind streak state", () => {
		let s = applyQualifyingDay(computeStreakFromDayKeys([]), "2026-06-01");
		s = applyQualifyingDay(s, "2026-06-02");
		s = applyQualifyingDay(s, "2026-06-03");
		expect(s.currentStreak).toBe(3);
		expect(s.lastActiveDay).toBe("2026-06-03");

		s = applyQualifyingDay(s, "2026-05-15");
		expect(s.currentStreak).toBe(3);
		expect(s.lastActiveDay).toBe("2026-06-03");
	});
});
