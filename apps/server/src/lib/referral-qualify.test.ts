import { describe, expect, test } from "bun:test";

import { isReferralReadyToQualify } from "./referral-qualify";

describe("isReferralReadyToQualify", () => {
	test("requires pending status, verified email, and onboardedAt", () => {
		expect(
			isReferralReadyToQualify({
				emailVerified: true,
				onboardedAt: new Date(),
				status: "pending",
			}),
		).toBe(true);
	});

	test("blocks when email is not verified", () => {
		expect(
			isReferralReadyToQualify({
				emailVerified: false,
				onboardedAt: new Date(),
				status: "pending",
			}),
		).toBe(false);
	});

	test("blocks when onboarding is incomplete", () => {
		expect(
			isReferralReadyToQualify({
				emailVerified: true,
				onboardedAt: null,
				status: "pending",
			}),
		).toBe(false);
	});

	test("blocks non-pending referrals", () => {
		expect(
			isReferralReadyToQualify({
				emailVerified: true,
				onboardedAt: new Date(),
				status: "qualified",
			}),
		).toBe(false);
	});
});
