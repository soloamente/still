import { describe, expect, test } from "bun:test";

import { isEligibleLeaderboardProfile } from "./leaderboard-profile-eligibility";

describe("isEligibleLeaderboardProfile", () => {
	test("excludes private profiles from community ranks", () => {
		expect(isEligibleLeaderboardProfile(true)).toBe(false);
		expect(isEligibleLeaderboardProfile(false)).toBe(true);
	});
});
