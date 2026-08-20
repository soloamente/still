import { describe, expect, test } from "bun:test";

import { clampFundingProgress } from "./discord-activity-funding-progress";

describe("clampFundingProgress", () => {
	test("clamps ratio at 1 when over target", () => {
		expect(clampFundingProgress(80, 50).ratio).toBe(1);
		expect(clampFundingProgress(80, 50).labelCurrent).toBe(80);
	});

	test("zero target safe", () => {
		expect(clampFundingProgress(5, 0).ratio).toBe(0);
	});
});
