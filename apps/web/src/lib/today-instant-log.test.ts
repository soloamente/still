import { describe, expect, test } from "bun:test";

import { buildTodayInstantLogPayload } from "./today-instant-log";

describe("buildTodayInstantLogPayload", () => {
	test("first watch: today at local noon, venue unset, no rewatch flag", () => {
		const payload = buildTodayInstantLogPayload({
			tmdbId: 603,
			priorLogCount: 0,
			todayYmd: "2026-09-23",
		});
		expect(payload).toEqual({
			movieId: 603,
			watchedAt: new Date("2026-09-23T12:00:00").toISOString(),
			watchVenue: null,
		});
	});

	test("prior diary entry marks a rewatch (new entry, prior untouched)", () => {
		const payload = buildTodayInstantLogPayload({
			tmdbId: 603,
			priorLogCount: 2,
			todayYmd: "2026-09-23",
		});
		expect(payload.rewatch).toBe(true);
	});

	test("never sends visibility or rating — account default applies, rating comes later", () => {
		const payload = buildTodayInstantLogPayload({
			tmdbId: 1,
			priorLogCount: 0,
			todayYmd: "2026-01-01",
		});
		expect("visibility" in payload).toBe(false);
		expect("rating" in payload).toBe(false);
	});
});
