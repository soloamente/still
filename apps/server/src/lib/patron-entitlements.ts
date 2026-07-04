import { db, planFeatureGrant, profile } from "@still/db";
import {
	hasPatronFeatureForTier,
	type PlanFeatureKey,
	type PlanTierId,
	parsePlanFeatureKeys,
	parsePlanTierId,
	resolveEffectiveTier,
} from "@still/plans";
import { eq } from "drizzle-orm";

/** Resolved subscription entitlements for a patron — shared by profile API and gates. */
export type PatronEntitlements = {
	subscriptionTier: PlanTierId;
	planOverride: PlanTierId | null;
	effectiveTier: PlanTierId;
	featureGrants: PlanFeatureKey[];
	/** @deprecated compat shim — immersed themes entitlement */
	isPro: boolean;
};

/** Pure resolver — used by tests and {@link loadPatronEntitlements}. */
export function computePatronEntitlements(input: {
	subscriptionTier: unknown;
	planOverride: unknown;
	featureGrantKeys: readonly string[];
}): PatronEntitlements {
	const subscriptionTier = parsePlanTierId(input.subscriptionTier);
	const planOverrideRaw = input.planOverride;
	const planOverride =
		planOverrideRaw == null || planOverrideRaw === ""
			? null
			: parsePlanTierId(planOverrideRaw);
	const featureGrants = parsePlanFeatureKeys(input.featureGrantKeys);
	const effectiveTier = resolveEffectiveTier({
		subscriptionTier,
		planOverride,
	});
	const isPro = hasPatronFeatureForTier({
		effectiveTier,
		grants: featureGrants,
		featureKey: "all_themes",
	});

	return {
		subscriptionTier,
		planOverride,
		effectiveTier,
		featureGrants,
		isPro,
	};
}

/** Load tier columns + staff grants for a patron and compute effective entitlements. */
export async function loadPatronEntitlements(
	userId: string,
): Promise<PatronEntitlements> {
	const [profileRow] = await db
		.select({
			subscriptionTier: profile.subscriptionTier,
			planOverride: profile.planOverride,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	const grantRows = await db
		.select({ featureKey: planFeatureGrant.featureKey })
		.from(planFeatureGrant)
		.where(eq(planFeatureGrant.userId, userId));

	return computePatronEntitlements({
		subscriptionTier: profileRow?.subscriptionTier ?? "still",
		planOverride: profileRow?.planOverride ?? null,
		featureGrantKeys: grantRows.map((row) => row.featureKey),
	});
}
