import { describe, expect, test } from "bun:test";

import {
	formatSubscriptionBillingInterval,
	SUBSCRIPTION_IDENTITY_GLOW_COLOR,
	subscriptionIdentityCardFx,
	subscriptionIdentityGlowColor,
	subscriptionStatusBadgeCopy,
} from "@/lib/subscription-identity-card";

describe("subscriptionStatusBadgeCopy", () => {
	test("maps known statuses", () => {
		expect(subscriptionStatusBadgeCopy("active").label).toBe("Active");
		expect(subscriptionStatusBadgeCopy("past_due").label).toBe("Payment issue");
		expect(subscriptionStatusBadgeCopy("canceled").label).toBe("Canceled");
		expect(subscriptionStatusBadgeCopy(null).label).toBe("Free");
	});
});

describe("formatSubscriptionBillingInterval", () => {
	test("formats month and year", () => {
		expect(formatSubscriptionBillingInterval("month")).toBe("Monthly billing");
		expect(formatSubscriptionBillingInterval("year")).toBe("Annual billing");
		expect(formatSubscriptionBillingInterval(null)).toBeNull();
	});
});

describe("subscriptionIdentityGlowColor", () => {
	test("returns a distinct oklch hue per plan rarity", () => {
		const still = subscriptionIdentityGlowColor("still");
		const attuned = subscriptionIdentityGlowColor("attuned");
		const immersed = subscriptionIdentityGlowColor("immersed");
		const devoted = subscriptionIdentityGlowColor("devoted");

		expect(still).toBe(SUBSCRIPTION_IDENTITY_GLOW_COLOR.still);
		expect(attuned).toBe(SUBSCRIPTION_IDENTITY_GLOW_COLOR.attuned);
		expect(immersed).toBe(SUBSCRIPTION_IDENTITY_GLOW_COLOR.immersed);
		expect(devoted).toBe(SUBSCRIPTION_IDENTITY_GLOW_COLOR.devoted);

		const hues = new Set([still, attuned, immersed, devoted]);
		expect(hues.size).toBe(4);
	});
});

describe("subscriptionIdentityCardFx", () => {
	test("maps each plan to its own chrome effect id", () => {
		expect(subscriptionIdentityCardFx("still")).toBe("still");
		expect(subscriptionIdentityCardFx("attuned")).toBe("attuned");
		expect(subscriptionIdentityCardFx("immersed")).toBe("immersed");
		expect(subscriptionIdentityCardFx("devoted")).toBe("devoted");
	});
});
