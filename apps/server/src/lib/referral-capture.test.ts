import { describe, expect, test } from "bun:test";
import { shouldRejectReferralCapture } from "./referral-capture";
import { normalizeReferralCode } from "./referral-code";

describe("normalizeReferralCode", () => {
	test("lowercases and trims valid codes", () => {
		expect(normalizeReferralCode("  Patron-42  ")).toBe("patron-42");
	});

	test("rejects empty and invalid characters", () => {
		expect(normalizeReferralCode("")).toBeNull();
		expect(normalizeReferralCode("bad code!")).toBeNull();
	});
});

describe("shouldRejectReferralCapture", () => {
	test("rejects same user id", () => {
		expect(
			shouldRejectReferralCapture({
				refereeUserId: "u1",
				referrerUserId: "u1",
				refereeEmail: "a@example.com",
				referrerEmail: "b@example.com",
			}),
		).toBe("self_user");
	});

	test("rejects same email", () => {
		expect(
			shouldRejectReferralCapture({
				refereeUserId: "u1",
				referrerUserId: "u2",
				refereeEmail: "Patron@Example.com",
				referrerEmail: "patron@example.com",
			}),
		).toBe("self_email");
	});

	test("allows distinct users and emails", () => {
		expect(
			shouldRejectReferralCapture({
				refereeUserId: "u1",
				referrerUserId: "u2",
				refereeEmail: "a@example.com",
				referrerEmail: "b@example.com",
			}),
		).toBeNull();
	});
});
