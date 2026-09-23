import { describe, expect, test } from "bun:test";

import { watchlistModeIntroCopy } from "./watchlist-mode-intro";

describe("watchlistModeIntroCopy", () => {
	test("prefixes with save count when provided", () => {
		expect(watchlistModeIntroCopy("tonight", { totalResults: 42 })).toBe(
			"42 saves · Ranked for tonight — one reason on each poster",
		);
	});

	test("uses singular save copy", () => {
		expect(watchlistModeIntroCopy("latest_added", { totalResults: 1 })).toBe(
			"1 save · Newest clips first — title on each poster",
		);
	});
});
