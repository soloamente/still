import { describe, expect, test } from "bun:test";

import {
	INITIAL_TODAY_PICK_STATE,
	reduceTodayPick,
	type TodayPickState,
	todayPickCompletedTmdbId,
	todayPickStatusCopy,
} from "./today-pick-state";

const active: TodayPickState = INITIAL_TODAY_PICK_STATE;
const logged: TodayPickState = {
	phase: "just_logged",
	tmdbId: 10,
	logId: "log-1",
};
const watchlisted: TodayPickState = {
	phase: "complete",
	tmdbId: 10,
	via: "watchlist",
};

describe("reduceTodayPick", () => {
	test("logging the active pick enters just_logged with the log id", () => {
		expect(
			reduceTodayPick(active, { type: "logged", tmdbId: 10, logId: "log-1" }),
		).toEqual(logged);
	});

	test("undo from just_logged returns to active", () => {
		expect(reduceTodayPick(logged, { type: "undo" })).toEqual(active);
	});

	test("undo is a no-op outside just_logged", () => {
		expect(reduceTodayPick(active, { type: "undo" })).toBe(active);
		expect(reduceTodayPick(watchlisted, { type: "undo" })).toBe(watchlisted);
	});

	test("watchlist add completes the pick without auto-swapping", () => {
		expect(
			reduceTodayPick(active, { type: "watchlisted", tmdbId: 10 }),
		).toEqual(watchlisted);
	});

	test("watchlist add after logging keeps the logged state (undo stays available)", () => {
		expect(reduceTodayPick(logged, { type: "watchlisted", tmdbId: 10 })).toBe(
			logged,
		);
	});

	test("logging after a watchlist add moves to just_logged", () => {
		expect(
			reduceTodayPick(watchlisted, {
				type: "logged",
				tmdbId: 10,
				logId: null,
			}),
		).toEqual({ phase: "just_logged", tmdbId: 10, logId: null });
	});

	test("consumed elsewhere (detail, other tab) completes an active pick", () => {
		expect(
			reduceTodayPick(active, { type: "consumed_elsewhere", tmdbId: 10 }),
		).toEqual({ phase: "complete", tmdbId: 10, via: "elsewhere" });
	});

	test("consumed elsewhere does not overwrite an existing completion", () => {
		expect(
			reduceTodayPick(logged, { type: "consumed_elsewhere", tmdbId: 10 }),
		).toBe(logged);
		expect(
			reduceTodayPick(watchlisted, { type: "consumed_elsewhere", tmdbId: 10 }),
		).toBe(watchlisted);
	});

	test("restored completion (finished on the title page) keeps how it was finished", () => {
		expect(
			reduceTodayPick(active, {
				type: "restored_complete",
				tmdbId: 10,
				via: "diary",
			}),
		).toEqual({ phase: "complete", tmdbId: 10, via: "diary" });
		expect(
			reduceTodayPick(active, {
				type: "restored_complete",
				tmdbId: 10,
				via: "watchlist",
			}),
		).toEqual({ phase: "complete", tmdbId: 10, via: "watchlist" });
	});

	test("restored completion never overrides a live Home completion", () => {
		expect(
			reduceTodayPick(logged, {
				type: "restored_complete",
				tmdbId: 10,
				via: "watchlist",
			}),
		).toBe(logged);
	});

	test("pick another returns to active from any completed phase", () => {
		expect(reduceTodayPick(logged, { type: "pick_another" })).toEqual(active);
		expect(reduceTodayPick(watchlisted, { type: "pick_another" })).toEqual(
			active,
		);
	});

	test("settling the rating (save or skip) closes Undo but keeps the pick complete", () => {
		expect(reduceTodayPick(logged, { type: "rating_settled" })).toEqual({
			phase: "complete",
			tmdbId: 10,
			via: "diary",
		});
	});

	test("rating_settled is a no-op outside just_logged", () => {
		expect(reduceTodayPick(active, { type: "rating_settled" })).toBe(active);
		expect(reduceTodayPick(watchlisted, { type: "rating_settled" })).toBe(
			watchlisted,
		);
	});

	test("not interested advance always lands on active", () => {
		expect(reduceTodayPick(active, { type: "not_interested_advanced" })).toBe(
			active,
		);
		expect(
			reduceTodayPick(watchlisted, { type: "not_interested_advanced" }),
		).toEqual(active);
	});
});

describe("todayPickCompletedTmdbId", () => {
	test("returns null while active and the title id once completed", () => {
		expect(todayPickCompletedTmdbId(active)).toBeNull();
		expect(todayPickCompletedTmdbId(logged)).toBe(10);
		expect(todayPickCompletedTmdbId(watchlisted)).toBe(10);
	});
});

describe("todayPickStatusCopy", () => {
	test("names what just happened, never guilt copy", () => {
		expect(todayPickStatusCopy(active)).toBeNull();
		expect(todayPickStatusCopy(logged)).toBe("Added to your diary");
		expect(todayPickStatusCopy(watchlisted)).toBe("Added to your watchlist");
		expect(
			todayPickStatusCopy({ phase: "complete", tmdbId: 1, via: "diary" }),
		).toBe("Added to your diary");
		expect(
			todayPickStatusCopy({ phase: "complete", tmdbId: 1, via: "elsewhere" }),
		).toBe("Done for today");
	});
});
