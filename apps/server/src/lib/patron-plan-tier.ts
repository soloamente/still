import { db, profile } from "@still/db";
import {
	type PlanTierId,
	parsePlanTierId,
	resolveEffectiveTier,
} from "@still/plans";
import { inArray } from "drizzle-orm";

/**
 * Batch effective plan tiers for avatar aura hydration — one profile query per
 * page. No plan_feature_grant join: grants unlock features, never tier.
 */
export async function fetchPlanTiersForUserIds(
	userIds: readonly string[],
): Promise<Map<string, PlanTierId>> {
	const unique = [...new Set(userIds.filter(Boolean))];
	const map = new Map<string, PlanTierId>();
	if (unique.length === 0) return map;

	const rows = await db
		.select({
			userId: profile.userId,
			subscriptionTier: profile.subscriptionTier,
			planOverride: profile.planOverride,
		})
		.from(profile)
		.where(inArray(profile.userId, unique));

	for (const row of rows) {
		map.set(
			row.userId,
			resolveEffectiveTier({
				subscriptionTier: parsePlanTierId(row.subscriptionTier),
				planOverride:
					row.planOverride == null || row.planOverride === ""
						? null
						: parsePlanTierId(row.planOverride),
			}),
		);
	}
	return map;
}

/** Missing profile rows read as the free tier. */
export function planTierForUserId(
	userId: string,
	tiers: Map<string, PlanTierId>,
): PlanTierId {
	return tiers.get(userId) ?? "still";
}
