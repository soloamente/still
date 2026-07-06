import { describe, expect, test } from "bun:test";

import type { PublicPlanTier } from "./fetch-public-plans";
import {
	buildPricingComparisonSections,
	incrementalPricingFeatures,
	pricingAnnualSavingsPercent,
	pricingMaxAnnualSavingsPercent,
	pricingTierCheckoutSlug,
	pricingTierHasCheckoutCta,
	pricingTierIncludesFeatureLabel,
} from "./pricing-tier-display";

function tier(
	id: PublicPlanTier["id"],
	name: string,
	features: PublicPlanTier["features"],
	overrides: Partial<PublicPlanTier> = {},
): PublicPlanTier {
	return {
		id,
		name,
		tagline: "",
		sortOrder: 0,
		priceMonthlyCents: null,
		priceYearlyCents: null,
		purchasable: false,
		checkoutSlugs: null,
		features,
		...overrides,
	};
}

const feature = (key: string, name: string, sortOrder = 0) => ({
	key,
	name,
	description: "",
	buildStatus: "exists",
	sortOrder,
});

describe("incrementalPricingFeatures", () => {
	const tiers = [
		tier("still", "Still", [
			feature("log", "Diary"),
			feature("lists", "Lists"),
		]),
		tier("attuned", "Attuned", [
			feature("log", "Diary"),
			feature("lists", "Lists"),
			feature("stats", "Full stats"),
		]),
		tier("devoted", "Devoted", [
			feature("log", "Diary"),
			feature("beta", "Beta access"),
		]),
	];

	test("still shows full foundation list", () => {
		expect(
			incrementalPricingFeatures(tiers[0], tiers).map((f) => f.key),
		).toEqual(["log", "lists"]);
	});

	test("attuned omits still features", () => {
		expect(
			incrementalPricingFeatures(tiers[1], tiers).map((f) => f.key),
		).toEqual(["stats"]);
	});

	test("devoted omits lower-tier catalogue rows", () => {
		expect(
			incrementalPricingFeatures(tiers[2], tiers).map((f) => f.key),
		).toEqual(["beta"]);
	});
});

describe("pricingTierIncludesFeatureLabel", () => {
	const tiers = [
		tier("still", "Still", []),
		tier("devoted", "Devoted", []),
		tier("immersed", "Immersed", []),
	];

	test("returns null for still", () => {
		expect(pricingTierIncludesFeatureLabel(tiers[0], tiers)).toBeNull();
	});

	test("uses Mobbin-style rollup copy", () => {
		expect(pricingTierIncludesFeatureLabel(tiers[1], tiers)).toBe(
			"All Immersed features",
		);
	});
});

describe("buildPricingComparisonSections", () => {
	test("groups features by first tier unlocked", () => {
		const tiers = [
			tier("still", "Still", [feature("log", "Diary", 1)]),
			tier("attuned", "Attuned", [
				feature("log", "Diary", 1),
				feature("stats", "Full stats", 2),
			]),
		];
		const sections = buildPricingComparisonSections(tiers);
		expect(sections[0]?.features.map((f) => f.key)).toEqual(["log"]);
		expect(sections[1]?.features.map((f) => f.key)).toEqual(["stats"]);
	});
});

describe("pricingTierCheckoutSlug", () => {
	test("falls back to devoted slugs when API omits checkoutSlugs", () => {
		expect(
			pricingTierCheckoutSlug({ id: "devoted", checkoutSlugs: null }, "year"),
		).toBe("devoted-yearly");
	});
});

describe("pricingTierHasCheckoutCta", () => {
	test("devoted is always checkout-enabled", () => {
		expect(
			pricingTierHasCheckoutCta({ id: "devoted", purchasable: false }),
		).toBe(true);
	});
});

describe("pricingAnnualSavingsPercent", () => {
	test("computes savings from monthly vs yearly", () => {
		const attuned = tier("attuned", "Attuned", [], {
			priceMonthlyCents: 300,
			priceYearlyCents: 2400,
			purchasable: true,
		});
		expect(pricingAnnualSavingsPercent(attuned)).toBe(33);
		expect(pricingMaxAnnualSavingsPercent([attuned])).toBe(33);
	});
});
