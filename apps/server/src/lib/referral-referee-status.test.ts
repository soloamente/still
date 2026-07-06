import { describe, expect, test } from "bun:test";

import { canPatronApplyReferralCode } from "./referral-referee-status";

describe("canPatronApplyReferralCode", () => {
	test("allows capture when no referrer is linked", () => {
		expect(
			canPatronApplyReferralCode({
				referredByUserId: null,
				hasRefereeReferralRow: false,
			}),
		).toBe(true);
	});

	test("blocks when referredByUserId is already set", () => {
		expect(
			canPatronApplyReferralCode({
				referredByUserId: "referrer-1",
				hasRefereeReferralRow: false,
			}),
		).toBe(false);
	});

	test("blocks when a patron_referral row already exists", () => {
		expect(
			canPatronApplyReferralCode({
				referredByUserId: null,
				hasRefereeReferralRow: true,
			}),
		).toBe(false);
	});
});
