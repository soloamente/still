import { describe, expect, test } from "bun:test";

import { upcomingWatchlistReleaseLabel } from "./watchlist-upcoming-release";

const TODAY = "2026-09-29";

function payload(rows: { type: number; release_date: string }[]) {
	return {
		release_dates: {
			results: [{ iso_3166_1: "IT", release_dates: rows }],
		},
	};
}

describe("upcomingWatchlistReleaseLabel", () => {
	test("names a future theatrical opening", () => {
		expect(
			upcomingWatchlistReleaseLabel(
				payload([{ type: 3, release_date: "2026-10-03T00:00:00.000Z" }]),
				"IT",
				TODAY,
			),
		).toBe("In cinemas Oct 3");
	});

	test("names a future digital date when cinemas already passed", () => {
		expect(
			upcomingWatchlistReleaseLabel(
				payload([
					{ type: 3, release_date: "2026-01-01" },
					{ type: 4, release_date: "2026-11-12" },
				]),
				"it",
				TODAY,
			),
		).toBe("Streaming Nov 12");
	});

	test("uses the sooner of cinema and streaming", () => {
		expect(
			upcomingWatchlistReleaseLabel(
				payload([
					{ type: 4, release_date: "2026-10-01" },
					{ type: 3, release_date: "2026-12-01" },
				]),
				"IT",
				TODAY,
			),
		).toBe("Streaming Oct 1");
	});

	test("ignores other countries and past-only dates", () => {
		expect(
			upcomingWatchlistReleaseLabel(
				{
					release_dates: {
						results: [
							{
								iso_3166_1: "US",
								release_dates: [{ type: 3, release_date: "2026-12-01" }],
							},
						],
					},
				},
				"IT",
				TODAY,
			),
		).toBeNull();
		expect(
			upcomingWatchlistReleaseLabel(
				payload([{ type: 3, release_date: "2026-01-02" }]),
				"IT",
				TODAY,
			),
		).toBeNull();
	});
});
