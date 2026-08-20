import { describe, expect, test } from "bun:test";
import { isPolarPayingSubscriptionStatus } from "./count-polar-paying-subscribers";

describe("isPolarPayingSubscriptionStatus", () => {
	test("active and past_due count", () => {
		expect(isPolarPayingSubscriptionStatus("active")).toBe(true);
		expect(isPolarPayingSubscriptionStatus("past_due")).toBe(true);
	});
	test("canceled / empty / other do not", () => {
		expect(isPolarPayingSubscriptionStatus("canceled")).toBe(false);
		expect(isPolarPayingSubscriptionStatus(null)).toBe(false);
		expect(isPolarPayingSubscriptionStatus("")).toBe(false);
		expect(isPolarPayingSubscriptionStatus("trialing")).toBe(false);
	});
});
