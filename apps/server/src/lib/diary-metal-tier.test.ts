import { describe, expect, test } from "bun:test";

import {
	diaryMetalTierForUserId,
	resolveDiaryMetalTier,
} from "./diary-metal-tier";

describe("resolveDiaryMetalTier", () => {
	test("no tier below 100", () => {
		expect(resolveDiaryMetalTier(0)).toBeNull();
		expect(resolveDiaryMetalTier(99)).toBeNull();
	});

	test("silver at 100", () => {
		expect(resolveDiaryMetalTier(100)).toBe("silver");
		expect(resolveDiaryMetalTier(499)).toBe("silver");
	});

	test("gold at 500", () => {
		expect(resolveDiaryMetalTier(500)).toBe("gold");
		expect(resolveDiaryMetalTier(999)).toBe("gold");
	});

	test("chromatic at 1000+", () => {
		expect(resolveDiaryMetalTier(1000)).toBe("chromatic");
		expect(resolveDiaryMetalTier(5000)).toBe("chromatic");
	});
});

describe("diaryMetalTierForUserId", () => {
	test("maps count from batch map", () => {
		const counts = new Map([["u-1", 250]]);
		expect(diaryMetalTierForUserId("u-1", counts)).toBe("silver");
		expect(diaryMetalTierForUserId("missing", counts)).toBeNull();
	});
});
