import { describe, expect, test } from "bun:test";

import {
	readWatchTonightDayPin,
	WATCH_TONIGHT_DAY_KEY,
	writeWatchTonightDayPin,
} from "./watch-tonight-day-pin";

function memoryStorage() {
	const map = new Map<string, string>();
	return {
		map,
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
		removeItem: (key: string) => {
			map.delete(key);
		},
	};
}

describe("watch tonight day pin", () => {
	test("yesterday's pin is removed", () => {
		const storage = memoryStorage();
		writeWatchTonightDayPin(storage, {
			dayKey: "2026-10-03",
			tmdbId: 11,
			skippedIds: [],
		});
		expect(readWatchTonightDayPin(storage, "2026-10-04")).toBeNull();
		expect(storage.map.has(WATCH_TONIGHT_DAY_KEY)).toBe(false);
	});

	test("today's pin round-trips", () => {
		const storage = memoryStorage();
		writeWatchTonightDayPin(storage, {
			dayKey: "2026-10-04",
			tmdbId: 11,
			skippedIds: [4],
		});
		expect(readWatchTonightDayPin(storage, "2026-10-04")).toEqual({
			dayKey: "2026-10-04",
			tmdbId: 11,
			skippedIds: [4],
		});
	});
});
