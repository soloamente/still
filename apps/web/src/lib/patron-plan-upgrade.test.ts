import { describe, expect, it } from "bun:test";

import {
	nextUpgradePlanTier,
	patronCanUpgradePlan,
	pricingHrefForPlanUpgrade,
} from "./patron-plan-upgrade";

describe("patronCanUpgradePlan", () => {
	it("is true below Devoted", () => {
		expect(patronCanUpgradePlan("still")).toBe(true);
		expect(patronCanUpgradePlan("immersed")).toBe(true);
	});

	it("is false at Devoted", () => {
		expect(patronCanUpgradePlan("devoted")).toBe(false);
	});
});

describe("nextUpgradePlanTier", () => {
	it("steps through paid tiers", () => {
		expect(nextUpgradePlanTier("still")).toBe("attuned");
		expect(nextUpgradePlanTier("attuned")).toBe("immersed");
		expect(nextUpgradePlanTier("immersed")).toBe("devoted");
		expect(nextUpgradePlanTier("devoted")).toBeNull();
	});
});

describe("pricingHrefForPlanUpgrade", () => {
	it("anchors pricing to the next tier column", () => {
		expect(pricingHrefForPlanUpgrade("still")).toBe("/pricing#attuned");
		expect(pricingHrefForPlanUpgrade("devoted")).toBeNull();
	});
});
