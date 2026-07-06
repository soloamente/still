import { describe, expect, test } from "bun:test";

import {
	DEFAULT_HOME_LEADERBOARD_PERIOD,
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
		expect(leaderboardWatchLedgerSummaryLabel(2, "tv", "all")).toBe(
			"2 shows watched all time",
		);
	});
});
