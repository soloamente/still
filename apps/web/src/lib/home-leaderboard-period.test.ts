import { describe, expect, test } from "bun:test";

import {
	DEFAULT_HOME_LEADERBOARD_PERIOD,
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
