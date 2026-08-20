import { describe, expect, test } from "bun:test";

import {
	leaderboardKindCountLabel,
	leaderboardKindEmptyLedgerLabel,
	leaderboardKindLedgerCta,
} from "./leaderboard-kind-labels";

describe("leaderboardKindCountLabel", () => {
	test("uses plural and singular nouns per kind", () => {
		expect(leaderboardKindCountLabel("films", 1)).toBe("film");
		expect(leaderboardKindCountLabel("films", 3)).toBe("films");
		expect(leaderboardKindCountLabel("tv", 1)).toBe("show");
		expect(leaderboardKindCountLabel("episodes", 2)).toBe("episodes");
	});
});

describe("leaderboardKindLedgerCta", () => {
	test("maps drawer CTAs", () => {
		expect(leaderboardKindLedgerCta("episodes")).toBe("View episodes");
	});
});

describe("leaderboardKindEmptyLedgerLabel", () => {
	test("empty grid copy", () => {
		expect(leaderboardKindEmptyLedgerLabel("episodes")).toBe("episode");
	});
});
