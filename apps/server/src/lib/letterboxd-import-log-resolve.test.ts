import { describe, expect, test } from "bun:test";

import {
	defaultMinimalLogWatchedAt,
	letterboxdTitleMatchKey,
	utcNoonOnDay,
} from "./letterboxd-import-log-resolve";

describe("letterboxdTitleMatchKey", () => {
	test("prefers Letterboxd URI", () => {
		expect(
			letterboxdTitleMatchKey({
				letterboxdUri: "https://boxd.it/abc",
				name: "Dune",
				year: 2021,
			}),
		).toBe("lburi:https://boxd.it/abc");
	});

	test("falls back to name and year", () => {
		expect(
			letterboxdTitleMatchKey({
				letterboxdUri: null,
				name: "Dune",
				year: 2021,
			}),
		).toBe("lb:dune:2021");
	});
});

describe("defaultMinimalLogWatchedAt", () => {
	test("uses explicit watched date first", () => {
		const watched = new Date("2024-01-15T08:00:00Z");
		expect(
			defaultMinimalLogWatchedAt(watched, null, new Date("2025-01-01")),
		).toEqual(watched);
	});

	test("falls back to UTC noon on import day", () => {
		const importDay = new Date("2025-06-09T18:30:00Z");
		expect(defaultMinimalLogWatchedAt(null, null, importDay)).toEqual(
			utcNoonOnDay(importDay),
		);
	});
});
