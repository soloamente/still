import { describe, expect, test } from "bun:test";

import {
	resolveShowsLedgerShowCount,
	SHOWS_RANK_LOG_SCOPES,
} from "./leaderboard-query";

describe("SHOWS_RANK_LOG_SCOPES", () => {
	test("counts finished seasons and whole series, never episodes", () => {
		expect([...SHOWS_RANK_LOG_SCOPES]).toEqual(["season", "show"]);
	});
});

describe("resolveShowsLedgerShowCount", () => {
	test("uses the public distinct-show count when it is larger", () => {
		expect(resolveShowsLedgerShowCount(5, [1, 2, 2])).toBe(5);
	});

	test("never reports fewer shows than the viewer can see", () => {
		// e.g. followers-only logs are visible to this viewer but not public.
		expect(resolveShowsLedgerShowCount(1, [1, 2, 3, 3])).toBe(3);
	});

	test("ignores null show ids", () => {
		expect(resolveShowsLedgerShowCount(0, [null, 4, null])).toBe(1);
	});
});
