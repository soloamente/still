import { describe, expect, test } from "bun:test";

import { isPersonFavoriteReleaseInNotifyWindow } from "./person-favorite-release-window";

describe("isPersonFavoriteReleaseInNotifyWindow", () => {
	// Fixed "today" so calendar-day math is deterministic in CI.
	const now = new Date("2026-09-21T15:00:00.000Z");

	test("includes release today", () => {
		expect(isPersonFavoriteReleaseInNotifyWindow("2026-09-21", now)).toBe(
			true,
		);
	});

	test("includes upcoming within 30 days", () => {
		expect(isPersonFavoriteReleaseInNotifyWindow("2026-10-21", now)).toBe(
			true,
		);
	});

	test("excludes upcoming beyond 30 days", () => {
		expect(isPersonFavoriteReleaseInNotifyWindow("2026-10-22", now)).toBe(
			false,
		);
	});

	test("includes past within 7 days", () => {
		expect(isPersonFavoriteReleaseInNotifyWindow("2026-09-14", now)).toBe(
			true,
		);
	});

	test("excludes past beyond 7 days", () => {
		expect(isPersonFavoriteReleaseInNotifyWindow("2026-09-13", now)).toBe(
			false,
		);
	});

	test("rejects null empty and invalid dates", () => {
		expect(isPersonFavoriteReleaseInNotifyWindow(null, now)).toBe(false);
		expect(isPersonFavoriteReleaseInNotifyWindow(undefined, now)).toBe(false);
		expect(isPersonFavoriteReleaseInNotifyWindow("", now)).toBe(false);
		expect(isPersonFavoriteReleaseInNotifyWindow("not-a-date", now)).toBe(
			false,
		);
	});
});
