import { db, planFeatureGrant, profile } from "@still/db";
import {
	type PlanFeatureKey,
	type PlanTierId,
	parsePlanFeatureKeys,
	parsePlanTierId,
} from "@still/plans";
import { and, eq, inArray } from "drizzle-orm";

/** Read staff grant-only feature keys for a patron. */
export async function readPatronFeatureGrantKeys(
	userId: string,
): Promise<PlanFeatureKey[]> {
	const rows = await db
		.select({ featureKey: planFeatureGrant.featureKey })
		.from(planFeatureGrant)
		.where(eq(planFeatureGrant.userId, userId));

	return parsePlanFeatureKeys(rows.map((row) => row.featureKey));
}

type ApplyStaffPatronPlanInput = {
	userId: string;
	grantedBy: string;
	planOverride: PlanTierId | null;
	featureGrants: readonly PlanFeatureKey[];
};

type ApplyStaffPatronPlanResult = {
	previousPlanOverride: PlanTierId | null;
	previousGrants: PlanFeatureKey[];
};

/**
 * Staff mutation — sets plan override and syncs grant rows.
 */
export async function applyStaffPatronPlan(
	input: ApplyStaffPatronPlanInput,
): Promise<ApplyStaffPatronPlanResult> {
	const [profileRow] = await db
		.select({
			planOverride: profile.planOverride,
		})
		.from(profile)
		.where(eq(profile.userId, input.userId))
		.limit(1);

	if (!profileRow) {
		throw new Error("PROFILE_NOT_FOUND");
	}

	const previousGrants = await readPatronFeatureGrantKeys(input.userId);
	const previousPlanOverride =
		profileRow.planOverride == null || profileRow.planOverride === ""
			? null
			: parsePlanTierId(profileRow.planOverride);

	const normalizedGrants = [
		...new Set(parsePlanFeatureKeys(input.featureGrants)),
	];

	await db
		.update(profile)
		.set({
			planOverride: input.planOverride,
			updatedAt: new Date(),
		})
		.where(eq(profile.userId, input.userId));

	const toRemove = previousGrants.filter(
		(key) => !normalizedGrants.includes(key),
	);
	const toAdd = normalizedGrants.filter((key) => !previousGrants.includes(key));

	if (toRemove.length > 0) {
		await db
			.delete(planFeatureGrant)
			.where(
				and(
					eq(planFeatureGrant.userId, input.userId),
					inArray(planFeatureGrant.featureKey, toRemove),
				),
			);
	}

	for (const featureKey of toAdd) {
		await db
			.insert(planFeatureGrant)
			.values({
				userId: input.userId,
				featureKey,
				grantedBy: input.grantedBy,
			})
			.onConflictDoNothing();
	}

	return { previousPlanOverride, previousGrants };
}
