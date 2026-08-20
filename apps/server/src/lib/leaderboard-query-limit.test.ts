import { describe, expect, test } from "bun:test";

import {
	LEADERBOARD_DEFAULT_LIMIT,
	LEADERBOARD_MAX_LIMIT,
	parseLeaderboardLimit,
} from "./leaderboard-query";

describe("parseLeaderboardLimit", () => {
	test("defaults and caps", () => {
		expect(parseLeaderboardLimit(undefined)).toBe(LEADERBOARD_DEFAULT_LIMIT);
		expect(parseLeaderboardLimit("99")).toBe(LEADERBOARD_MAX_LIMIT);
		expect(parseLeaderboardLimit("10")).toBe(10);
	});
});
