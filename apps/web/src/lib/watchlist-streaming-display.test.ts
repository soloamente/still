import { describe, expect, test } from "bun:test";

import {
	formatWatchlistStreamingPill,
	watchlistAlertOnToastCopy,
	watchlistAlertPreviewBodyCopy,
	watchlistAlertPreviewPosters,
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

	test("preview body names the region when known", () => {
		expect(watchlistAlertPreviewBodyCopy(4, "IT")).toBe(
			"4 of your saved titles aren't streaming in Italy yet — Attuned tells you the day they land.",
		);
		expect(watchlistAlertPreviewBodyCopy(1, "IT")).toBe(
			"1 of your saved titles isn't streaming in Italy yet — Attuned tells you the day it lands.",
		);
		expect(watchlistAlertPreviewBodyCopy(2, null)).toContain(
			"aren't streaming yet",
		);
	});
});

describe("watchlistAlertPreviewPosters", () => {
	const p = (tmdbId: number, listingKind: "movie" | "tv" = "movie") => ({
		listingKind,
		tmdbId,
		title: `T${tmdbId}`,
		posterUrl: null,
	});
	test("tapped title leads and is de-duped against the sample", () => {
		expect(
			watchlistAlertPreviewPosters(p(2), [p(1), p(2), p(3)]).map(
				(x) => x.tmdbId,
			),
		).toEqual([2, 1, 3]);
	});
	test("caps at 3", () => {
		expect(
			watchlistAlertPreviewPosters(p(9), [p(1), p(2), p(3)]).map(
				(x) => x.tmdbId,
			),
		).toEqual([9, 1, 2]);
	});
	test("same id across kinds is not a duplicate", () => {
		expect(watchlistAlertPreviewPosters(p(5, "tv"), [p(5)]).length).toBe(2);
	});
	test("no tapped title → sample only", () => {
		expect(watchlistAlertPreviewPosters(null, [p(1)]).length).toBe(1);
	});
});
