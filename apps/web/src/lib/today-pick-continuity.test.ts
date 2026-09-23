import { describe, expect, test } from "bun:test";

import type { TasteMatchMovie } from "./taste-matched-discovery";
import {
	clearTodayPickContinuity,
	markTodayPickContinuityCompleted,
	readTodayPickContinuity,
	TODAY_PICK_CONTINUITY_KEY,
	TODAY_PICK_CONTINUITY_TTL_MS,
	type TodayPickContinuityStorage,
	todayPickDetailCue,
	writeTodayPickContinuity,
} from "./today-pick-continuity";

function memoryStorage(): TodayPickContinuityStorage & {
	map: Map<string, string>;
} {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key) => map.get(key) ?? null,
		setItem: (key, value) => {
			map.set(key, value);
		},
		removeItem: (key) => {
			map.delete(key);
		},
	};
}

const film: TasteMatchMovie = {
	tmdbId: 603,
	title: "The Matrix",
	posterPath: "/p.jpg",
	backdropPath: "/b.jpg",
	year: 1999,
};
const reason = "Because you gravitate toward sci-fi";

describe("today pick continuity", () => {
	test("write → read round-trips the pick and reason", () => {
		const storage = memoryStorage();
		writeTodayPickContinuity({ film, reason }, { storage, now: 1_000 });
		expect(readTodayPickContinuity({ storage, now: 2_000 })).toEqual({
			tmdbId: 603,
			mediaKind: "movie",
			reason,
			film,
			setAt: 1_000,
			completedVia: null,
		});
	});

	test("expired or malformed entries read as null and are removed", () => {
		const storage = memoryStorage();
		writeTodayPickContinuity({ film, reason }, { storage, now: 0 });
		expect(
			readTodayPickContinuity({
				storage,
				now: TODAY_PICK_CONTINUITY_TTL_MS + 1,
			}),
		).toBeNull();
		expect(storage.map.has(TODAY_PICK_CONTINUITY_KEY)).toBe(false);

		storage.setItem(TODAY_PICK_CONTINUITY_KEY, "{not json");
		expect(readTodayPickContinuity({ storage, now: 0 })).toBeNull();
		storage.setItem(TODAY_PICK_CONTINUITY_KEY, JSON.stringify({ tmdbId: "x" }));
		expect(readTodayPickContinuity({ storage, now: 0 })).toBeNull();
	});

	test("clear removes the entry", () => {
		const storage = memoryStorage();
		writeTodayPickContinuity({ film, reason }, { storage, now: 0 });
		clearTodayPickContinuity({ storage, now: 0 });
		expect(readTodayPickContinuity({ storage, now: 0 })).toBeNull();
	});

	test("completion marks only the matching title; diary outranks watchlist", () => {
		const storage = memoryStorage();
		writeTodayPickContinuity({ film, reason }, { storage, now: 0 });

		markTodayPickContinuityCompleted(999, "diary", { storage, now: 0 });
		expect(
			readTodayPickContinuity({ storage, now: 0 })?.completedVia,
		).toBeNull();

		markTodayPickContinuityCompleted(603, "diary", { storage, now: 0 });
		markTodayPickContinuityCompleted(603, "watchlist", { storage, now: 0 });
		expect(readTodayPickContinuity({ storage, now: 0 })?.completedVia).toBe(
			"diary",
		);
	});

	test("watchlist completion upgrades to diary later", () => {
		const storage = memoryStorage();
		writeTodayPickContinuity({ film, reason }, { storage, now: 0 });
		markTodayPickContinuityCompleted(603, "watchlist", { storage, now: 0 });
		markTodayPickContinuityCompleted(603, "diary", { storage, now: 0 });
		expect(readTodayPickContinuity({ storage, now: 0 })?.completedVia).toBe(
			"diary",
		);
	});

	test("no storage (SSR / blocked) is a quiet no-op", () => {
		expect(() =>
			writeTodayPickContinuity({ film, reason }, { storage: null }),
		).not.toThrow();
		expect(readTodayPickContinuity({ storage: null })).toBeNull();
	});
});

describe("todayPickDetailCue", () => {
	const entry = {
		tmdbId: 603,
		mediaKind: "movie" as const,
		reason,
		film,
		setAt: 0,
		completedVia: null,
	};

	test("cue only for the same film", () => {
		expect(todayPickDetailCue(entry, "movie", 603)).toEqual({ reason });
		expect(todayPickDetailCue(entry, "movie", 604)).toBeNull();
		expect(todayPickDetailCue(entry, "tv", 603)).toBeNull();
		expect(todayPickDetailCue(null, "movie", 603)).toBeNull();
	});
});
