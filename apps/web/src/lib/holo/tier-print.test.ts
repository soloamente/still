import { describe, expect, test } from "bun:test";

import { subscriptionHoloAppearance } from "./tier-print";

describe("subscriptionHoloAppearance", () => {
	test("maps tiers to locked foil keys", () => {
		expect(subscriptionHoloAppearance("still").foil.key).toBe("brushed");
		expect(subscriptionHoloAppearance("attuned").foil.key).toBe("holo");
		expect(subscriptionHoloAppearance("immersed").foil.key).toBe("velvet");
		expect(subscriptionHoloAppearance("devoted").foil.key).toBe("cosmos");
	});

	test("prints are pale (high lightness) and distinct per tier", () => {
		const still = subscriptionHoloAppearance("still").bodyGrad;
		const devoted = subscriptionHoloAppearance("devoted").bodyGrad;
		expect(still).not.toBe(devoted);
		expect(still.toLowerCase()).toContain("linear-gradient");
	});
});
