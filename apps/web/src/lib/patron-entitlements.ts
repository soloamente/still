import {
	hasPatronFeatureForTier,
	type PlanFeatureKey,
	type PlanTierId,
	parsePlanFeatureKeys,
	parsePlanTierId,
	resolveEffectiveTier,
} from "@still/plans";

import type { MeProfile } from "@/lib/fetch-me-profile";

export {
	hasPatronFeatureForTier,
	MIN_TIER_FOR_FEATURE,
	type PlanFeatureKey,
	type PlanTierId,
	parsePlanFeatureKeys,
	parsePlanTierId,
	resolveEffectiveTier,
} from "@still/plans";

/** Client-side entitlement snapshot derived from GET /api/profiles/me. */
export type PatronEntitlementsSnapshot = {
	subscriptionTier: PlanTierId;
	planOverride: PlanTierId | null;
	effectiveTier: PlanTierId;
	featureGrants: PlanFeatureKey[];
	isPro: boolean;
	hasFeature: (featureKey: PlanFeatureKey) => boolean;
};

const EMPTY_ENTITLEMENTS: PatronEntitlementsSnapshot = {
	subscriptionTier: "still",
	planOverride: null,
	effectiveTier: "still",
	featureGrants: [],
	isPro: false,
	hasFeature: () => false,
};

/** Build resolver helpers from profile API entitlement fields. */
export function buildPatronEntitlementsFromProfile(
	profile: MeProfile | null | undefined,
): PatronEntitlementsSnapshot {
	if (!profile) return EMPTY_ENTITLEMENTS;

	const subscriptionTier = parsePlanTierId(profile.subscriptionTier ?? "still");
	const planOverride =
		profile.planOverride == null ? null : parsePlanTierId(profile.planOverride);
	const featureGrants = parsePlanFeatureKeys(profile.featureGrants ?? []);
	const effectiveTier =
		profile.effectiveTier != null
			? parsePlanTierId(profile.effectiveTier)
			: resolveEffectiveTier({ subscriptionTier, planOverride });
	const isPro = hasPatronFeatureForTier({
		effectiveTier,
		grants: featureGrants,
		featureKey: "all_themes",
	});

	const hasFeature = (featureKey: PlanFeatureKey) =>
		hasPatronFeatureForTier({
			effectiveTier,
			grants: featureGrants,
			featureKey,
		});

	return {
		subscriptionTier,
		planOverride,
		effectiveTier,
		featureGrants,
		isPro,
		hasFeature,
	};
}
