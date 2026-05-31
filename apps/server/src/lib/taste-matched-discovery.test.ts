import { describe, expect, test } from "bun:test";

import {
	TASTE_MATCH_MIN_LOGS,
	TASTE_MATCH_MIN_RESULTS,
} from "./taste-matched-discovery";

describe("taste-matched-discovery thresholds", () => {
	test("matches ST.4 success criteria", () => {
		expect(TASTE_MATCH_MIN_LOGS).toBe(10);
		expect(TASTE_MATCH_MIN_RESULTS).toBe(6);
	});
});
