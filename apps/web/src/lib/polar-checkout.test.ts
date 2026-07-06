import { describe, expect, test } from "bun:test";

import { canManagePolarBilling, pricingTierCtaLabel } from "./polar-billing";

describe("canManagePolarBilling", () => {
	test("true when Polar subscription id is present", () => {
		expect(
			canManagePolarBilling({
				polarSubscriptionId: "sub_123",
				subscriptionTier: "still",
				subscriptionStatus: null,
			}),
		).toBe(true);
	});

	test("true for active paid tier without explicit subscription id", () => {
		expect(
			canManagePolarBilling({
				polarSubscriptionId: null,
				subscriptionTier: "attuned",
				subscriptionStatus: "active",
			}),
		).toBe(true);
	});

	test("false for free tier with no Polar subscription", () => {
		expect(
			canManagePolarBilling({
				polarSubscriptionId: null,
				subscriptionTier: "still",
				subscriptionStatus: null,
			}),
		).toBe(false);
	});
});

describe("pricingTierCtaLabel", () => {
	test("upgrade when target tier ranks higher", () => {
		expect(pricingTierCtaLabel("immersed", "attuned")).toBe("Upgrade");
	});

	test("switch plan when target tier ranks lower", () => {
		expect(pricingTierCtaLabel("attuned", "immersed")).toBe("Switch plan");
	});
});
