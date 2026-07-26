import { describe, expect, it } from "bun:test";

import { planTierForUserId } from "./patron-plan-tier";

describe("planTierForUserId", () => {
	it("returns the mapped tier", () => {
		const tiers = new Map([["u1", "devoted" as const]]);
		expect(planTierForUserId("u1", tiers)).toBe("devoted");
	});

	it("defaults missing users to still", () => {
		expect(planTierForUserId("ghost", new Map())).toBe("still");
	});
});
