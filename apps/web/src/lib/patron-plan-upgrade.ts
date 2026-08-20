import {
	PLAN_TIER_IDS,
	type PlanTierId,
	parsePlanTierId,
	tierRank,
} from "@still/plans";

/** True when the patron is below Devoted and can move to a higher paid tier. */
export function patronCanUpgradePlan(planTier: unknown): boolean {
	const tier = parsePlanTierId(planTier);
	return tierRank(tier) < tierRank("devoted");
}

/** Next purchasable tier above the patron's effective tier — null at Devoted. */
export function nextUpgradePlanTier(planTier: unknown): PlanTierId | null {
	const tier = parsePlanTierId(planTier);
	const nextRank = tierRank(tier) + 1;
	if (nextRank >= PLAN_TIER_IDS.length) return null;
	return PLAN_TIER_IDS[nextRank] ?? null;
}

/** Deep link into pricing for the next upgrade step. */
export function pricingHrefForPlanUpgrade(planTier: unknown): string | null {
	const next = nextUpgradePlanTier(planTier);
	if (!next || next === "still") return null;
	return `/pricing#${next}`;
}
