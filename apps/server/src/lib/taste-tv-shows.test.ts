import { describe, expect, test } from "bun:test";

import {
	distinctTvShowIds,
	newestTvLogPerShow,
	tvTasteIsColdStart,
} from "./taste-tv-shows";

describe("distinctTvShowIds", () => {
	test("show, season, and episode logs of one show count once", () => {
		expect(
			distinctTvShowIds([
				{ tvId: 9 },
				{ tvId: 9 },
				{ tvId: null },
				{ tvId: 10 },
			]),
		).toEqual([9, 10]);
	});
});

describe("newestTvLogPerShow", () => {
	test("keeps the latest log for each show", () => {
		const older = {
			tvId: 9,
			watchedAt: "2026-09-01T00:00:00.000Z",
			rating: 40,
		};
		const newer = {
			tvId: 9,
			watchedAt: "2026-09-20T00:00:00.000Z",
			rating: 90,
		};
		expect(newestTvLogPerShow([older, newer])).toEqual([newer]);
	});
});

describe("tvTasteIsColdStart", () => {
	test("ten episodes of one show stay cold", () => {
		const rows = Array.from({ length: 10 }, () => ({ tvId: 9 }));
		expect(tvTasteIsColdStart(distinctTvShowIds(rows).length)).toBe(true);
	});

	test("ten distinct shows are enough", () => {
		const rows = Array.from({ length: 10 }, (_, i) => ({ tvId: i + 1 }));
		expect(tvTasteIsColdStart(distinctTvShowIds(rows).length)).toBe(false);
	});
});
