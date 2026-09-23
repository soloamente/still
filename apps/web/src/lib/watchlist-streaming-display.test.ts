import { describe, expect, test } from "bun:test";

import {
	formatWatchlistStreamingPill,
	watchlistAlertOnToastCopy,
	watchlistAlertPreviewBodyCopy,
	watchlistRegionLabel,
} from "./watchlist-streaming-display";

describe("formatWatchlistStreamingPill", () => {
	test("formats watchlist lobby pill", () => {
		expect(formatWatchlistStreamingPill("Netflix")).toBe("Now on Netflix");
	});

	test("returns empty for blank provider", () => {
		expect(formatWatchlistStreamingPill("   ")).toBe("");
	});
});

describe("watchlist alert copy", () => {
	test("region label uses the English country name", () => {
		expect(watchlistRegionLabel("gb")).toBe("United Kingdom");
		expect(watchlistRegionLabel("IT")).toBe("Italy");
	});

	test("success toast names the region", () => {
		expect(watchlistAlertOnToastCopy("IT")).toBe(
			"We'll tell you when it streams in Italy",
		);
		expect(watchlistAlertOnToastCopy(null)).toBe(
			"We'll tell you when it streams",
		);
	});

	test("preview body never says 0 titles", () => {
		expect(watchlistAlertPreviewBodyCopy(0)).toBe(
			"Attuned tells you the day your saved titles land on your services.",
		);
		expect(watchlistAlertPreviewBodyCopy(1)).toContain(
			"1 of your saved titles",
		);
		expect(watchlistAlertPreviewBodyCopy(4)).toContain(
			"4 of your saved titles",
		);
	});
});
