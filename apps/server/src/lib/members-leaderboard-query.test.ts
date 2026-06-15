import { describe, expect, test } from "bun:test";

import { resolveLeaderboardWindow } from "./leaderboard-period";
import {
	isEligibleMembersLeaderboardProfile,
	MEMBERS_LEADERBOARD_DEFAULT_LIMIT,
	MEMBERS_LEADERBOARD_MAX_LIMIT,
	parseMembersLeaderboardLimit,
	parseMembersLeaderboardSort,
	rankMembersLeaderboardRows,
} from "./members-leaderboard-query";

describe("parseMembersLeaderboardSort", () => {
	test("accepts known sorts", () => {
		expect(parseMembersLeaderboardSort("popular")).toBe("popular");
		expect(parseMembersLeaderboardSort("reviews")).toBe("reviews");
		expect(parseMembersLeaderboardSort("lists")).toBe("lists");
		expect(parseMembersLeaderboardSort("likes")).toBe("likes");
	});

	test("defaults to popular", () => {
		expect(parseMembersLeaderboardSort(undefined)).toBe("popular");
		expect(parseMembersLeaderboardSort("bogus")).toBe("popular");
	});
});

describe("parseMembersLeaderboardLimit", () => {
	test("defaults and caps", () => {
		expect(parseMembersLeaderboardLimit(undefined)).toBe(
			MEMBERS_LEADERBOARD_DEFAULT_LIMIT,
		);
		expect(parseMembersLeaderboardLimit("99")).toBe(
			MEMBERS_LEADERBOARD_MAX_LIMIT,
		);
		expect(parseMembersLeaderboardLimit("10")).toBe(10);
	});
});

describe("isEligibleMembersLeaderboardProfile", () => {
	test("excludes private profiles", () => {
		expect(isEligibleMembersLeaderboardProfile(true)).toBe(false);
		expect(isEligibleMembersLeaderboardProfile(false)).toBe(true);
	});
});

describe("membersLeaderboardSort", () => {
	test("popular uses diary watchedAt window bounds", () => {
		const now = new Date("2026-05-15T12:00:00Z");
		const window = resolveLeaderboardWindow("month", "UTC", now);
		expect(window.start.toISOString()).toBe("2026-05-01T00:00:00.000Z");
		expect(window.end.toISOString()).toBe("2026-06-01T00:00:00.000Z");
	});

	test("rankMembersLeaderboardRows orders by count then tie time", () => {
		const ranked = rankMembersLeaderboardRows([
			{
				userId: "a",
				handle: "ada",
				displayName: "Ada",
				image: null,
				preferences: null,
				count: 3,
				tieAt: new Date("2026-05-10T00:00:00Z"),
			},
			{
				userId: "b",
				handle: "ben",
				displayName: "Ben",
				image: null,
				preferences: null,
				count: 5,
				tieAt: new Date("2026-05-12T00:00:00Z"),
			},
			{
				userId: "c",
				handle: "cleo",
				displayName: "Cleo",
				image: null,
				preferences: null,
				count: 5,
				tieAt: new Date("2026-05-08T00:00:00Z"),
			},
		]);

		expect(ranked.map((row) => row.handle)).toEqual(["cleo", "ben", "ada"]);
		expect(ranked.map((row) => row.rank)).toEqual([1, 2, 3]);
	});
});
