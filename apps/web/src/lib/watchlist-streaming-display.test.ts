import { describe, expect, test } from "bun:test";

import { formatWatchlistStreamingPill } from "./watchlist-streaming-display";

describe("formatWatchlistStreamingPill", () => {
	test("formats watchlist lobby pill", () => {
		expect(formatWatchlistStreamingPill("Netflix")).toBe("Now on Netflix");
	});

	test("returns empty for blank provider", () => {
		expect(formatWatchlistStreamingPill("   ")).toBe("");
	});
});
