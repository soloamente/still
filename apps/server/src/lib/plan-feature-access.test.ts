import { describe, expect, test } from "bun:test";

import { computePatronEntitlements } from "./patron-entitlements";
import {
	canAccessYearInReviewYear,
	currentUtcCalendarYear,
	isPremiumStreamingMonetizationFilter,
	patronHasPlanFeature,
} from "./plan-feature-access";

describe("canAccessYearInReviewYear", () => {
	const currentYear = currentUtcCalendarYear();

	test("Still tier — current UTC year only", () => {
		const still = computePatronEntitlements({
			subscriptionTier: "still",
			planOverride: null,
			featureGrantKeys: [],
		});
		expect(canAccessYearInReviewYear(currentYear, still)).toBe(true);
		expect(canAccessYearInReviewYear(currentYear - 1, still)).toBe(false);
	});

	test("Attuned tier — any year", () => {
		const attuned = computePatronEntitlements({
			subscriptionTier: "attuned",
			planOverride: null,
			featureGrantKeys: [],
		});
		expect(canAccessYearInReviewYear(2019, attuned)).toBe(true);
	});
});

describe("isPremiumStreamingMonetizationFilter", () => {
	test("flatrate is not premium", () => {
		expect(isPremiumStreamingMonetizationFilter("flatrate")).toBe(false);
		expect(isPremiumStreamingMonetizationFilter("")).toBe(false);
	});

	test("rent buy free ads require Attuned", () => {
		expect(isPremiumStreamingMonetizationFilter("rent")).toBe(true);
		expect(isPremiumStreamingMonetizationFilter("buy")).toBe(true);
		expect(isPremiumStreamingMonetizationFilter("free")).toBe(true);
		expect(isPremiumStreamingMonetizationFilter("ads")).toBe(true);
	});
});

describe("patronHasPlanFeature", () => {
	test("watchlist_alerts on Attuned", () => {
		const attuned = computePatronEntitlements({
			subscriptionTier: "attuned",
			planOverride: null,
			featureGrantKeys: [],
		});
		expect(patronHasPlanFeature(attuned, "watchlist_alerts")).toBe(true);
	});

	test("watchlist_alerts denied on Still", () => {
		const still = computePatronEntitlements({
			subscriptionTier: "still",
			planOverride: null,
			featureGrantKeys: [],
		});
		expect(patronHasPlanFeature(still, "watchlist_alerts")).toBe(false);
	});
});
