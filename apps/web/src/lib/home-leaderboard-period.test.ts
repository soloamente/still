import { describe, expect, test } from "bun:test";

import {
	DEFAULT_HOME_LEADERBOARD_PERIOD,
	leaderboardLedgerTitleCount,
	leaderboardWatchLedgerSummaryLabel,
	parseHomeCommunityPeriod,
} from "./home-leaderboard-period";

describe("parseHomeCommunityPeriod", () => {
	test("parses known periods", () => {
		expect(parseHomeCommunityPeriod("week")).toBe("week");
		expect(parseHomeCommunityPeriod("all")).toBe("all");
	});

	test("defaults when missing or invalid", () => {
		expect(parseHomeCommunityPeriod(undefined)).toBe(
			DEFAULT_HOME_LEADERBOARD_PERIOD,
		);
		expect(parseHomeCommunityPeriod("bogus")).toBe(
			DEFAULT_HOME_LEADERBOARD_PERIOD,
		);
	});
});

describe("leaderboardWatchLedgerSummaryLabel", () => {
	test("combines count, media, and period phrasing", () => {
		expect(leaderboardWatchLedgerSummaryLabel(13, "films", "month")).toBe(
			"13 films watched this month",
		);
		expect(leaderboardWatchLedgerSummaryLabel(1, "films", "week")).toBe(
			"1 film watched this week",
		);
		expect(leaderboardWatchLedgerSummaryLabel(4, "tv", "year")).toBe(
			"4 shows watched this year",
		);
		expect(leaderboardWatchLedgerSummaryLabel(2, "episodes", "week")).toBe(
			"2 episodes watched this week",
		);
		expect(leaderboardWatchLedgerSummaryLabel(2, "tv", "all")).toBe(
			"2 shows watched all time",
		);
	});
});

describe("leaderboardLedgerTitleCount", () => {
	test("Shows uses the distinct show count, not the tile count", () => {
		expect(
			leaderboardLedgerTitleCount({
				kind: "tv",
				itemCount: 5,
				hiddenCount: 1,
				showCount: 2,
			}),
		).toBe(2);
	});

	test("falls back to tiles + hidden when no show count is sent", () => {
		expect(
			leaderboardLedgerTitleCount({
				kind: "tv",
				itemCount: 3,
				hiddenCount: 1,
			}),
		).toBe(4);
	});

	test("Films and Episodes ignore showCount", () => {
		expect(
			leaderboardLedgerTitleCount({
				kind: "films",
				itemCount: 3,
				hiddenCount: 2,
				showCount: 99,
			}),
		).toBe(5);
	});
});
