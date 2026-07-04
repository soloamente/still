import { describe, expect, test } from "bun:test";
import { computePatronEntitlements } from "./patron-entitlements";

describe("computePatronEntitlements", () => {
	test("defaults to still with no grants", () => {
		expect(
			computePatronEntitlements({
				subscriptionTier: "still",
				planOverride: null,
				featureGrantKeys: [],
			}),
		).toEqual({
			subscriptionTier: "still",
			planOverride: null,
			effectiveTier: "still",
			featureGrants: [],
			isPro: false,
		});
	});

	test("planOverride wins over subscriptionTier", () => {
		const entitlements = computePatronEntitlements({
			subscriptionTier: "attuned",
			planOverride: "immersed",
			featureGrantKeys: [],
		});
		expect(entitlements.effectiveTier).toBe("immersed");
		expect(entitlements.isPro).toBe(true);
	});

	test("isPro reflects all_themes entitlement", () => {
		expect(
			computePatronEntitlements({
				subscriptionTier: "attuned",
				planOverride: null,
				featureGrantKeys: [],
			}).isPro,
		).toBe(false);
		expect(
			computePatronEntitlements({
				subscriptionTier: "immersed",
				planOverride: null,
				featureGrantKeys: [],
			}).isPro,
		).toBe(true);
	});

	test("grant-only all_themes unlocks isPro on still tier", () => {
		expect(
			computePatronEntitlements({
				subscriptionTier: "still",
				planOverride: null,
				featureGrantKeys: ["all_themes"],
			}),
		).toMatchObject({
			effectiveTier: "still",
			featureGrants: ["all_themes"],
			isPro: true,
		});
	});

	test("invalid tier strings fall back to still", () => {
		expect(
			computePatronEntitlements({
				subscriptionTier: "bogus",
				planOverride: "also-bogus",
				featureGrantKeys: ["all_themes", "unknown_key"],
			}),
		).toMatchObject({
			subscriptionTier: "still",
			planOverride: "still",
			featureGrants: ["all_themes"],
		});
	});
});
