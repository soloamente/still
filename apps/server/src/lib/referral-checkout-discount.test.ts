import { describe, expect, test } from "bun:test";

import {
	isReferralCheckoutDiscountEligible,
	resolveReferralCheckoutDiscountId,
} from "./referral-checkout-discount";

describe("referral checkout discount", () => {
	test("eligible when referred, not redeemed, and discount configured", () => {
		expect(
			isReferralCheckoutDiscountEligible({
				referredByUserId: "referrer-1",
				referralDiscountRedeemed: false,
				discountIdConfigured: true,
			}),
		).toBe(true);
	});

	test("blocks when discount env is missing", () => {
		expect(
			isReferralCheckoutDiscountEligible({
				referredByUserId: "referrer-1",
				referralDiscountRedeemed: false,
				discountIdConfigured: false,
			}),
		).toBe(false);
	});

	test("blocks when already redeemed", () => {
		expect(
			isReferralCheckoutDiscountEligible({
				referredByUserId: "referrer-1",
				referralDiscountRedeemed: true,
				discountIdConfigured: true,
			}),
		).toBe(false);
	});

	test("blocks when patron was not referred", () => {
		expect(
			isReferralCheckoutDiscountEligible({
				referredByUserId: null,
				referralDiscountRedeemed: false,
				discountIdConfigured: true,
			}),
		).toBe(false);
	});
});

describe("resolveReferralCheckoutDiscountId", () => {
	test("returns configured discount id when eligible", () => {
		expect(
			resolveReferralCheckoutDiscountId({
				referredByUserId: "referrer-1",
				referralDiscountRedeemed: false,
				configuredDiscountId: "disc_referral10",
			}),
		).toBe("disc_referral10");
	});

	test("returns null when ineligible", () => {
		expect(
			resolveReferralCheckoutDiscountId({
				referredByUserId: null,
				referralDiscountRedeemed: false,
				configuredDiscountId: "disc_referral10",
			}),
		).toBeNull();
	});
});
