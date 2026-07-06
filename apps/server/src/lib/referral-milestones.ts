import { db, patronReferral, patronReferralReward, profile } from "@still/db";
import {
	type PlanTierId,
	parsePlanTierId,
	REFERRAL_MILESTONES,
	type ReferralMilestoneKey,
	resolveEffectiveTier,
	tierRank,
} from "@still/plans";
import { and, count, eq } from "drizzle-orm";

import { makeId } from "./cuid";
import { deliverNotification } from "./notification-delivery";
import {
	mergeReferralRewardsPref,
	type ReferralRewardsPref,
} from "./referral-rewards-pref";

const SUBSCRIPTION_REWARD_DAYS: Partial<Record<ReferralMilestoneKey, number>> =
	{
		attuned_1mo: 30,
		immersed_1mo: 30,
		immersed_3mo: 90,
	};

type MilestoneRewardType =
	| "badge"
	| "banner_frame"
	| "plan_override"
	| "plan_override_permanent";

function milestoneRewardType(key: ReferralMilestoneKey): MilestoneRewardType {
	switch (key) {
		case "scout_badge":
		case "ambassador_badge":
			return "badge";
		case "connector_frame":
			return "banner_frame";
		case "immersed_life":
			return "plan_override_permanent";
		default:
			return "plan_override";
	}
}

function milestonePlanTier(key: ReferralMilestoneKey): PlanTierId | null {
	switch (key) {
		case "attuned_1mo":
			return "attuned";
		case "immersed_1mo":
		case "immersed_3mo":
		case "immersed_life":
			return "immersed";
		default:
			return null;
	}
}

function identityRewardPatch(
	key: ReferralMilestoneKey,
): ReferralRewardsPref | null {
	switch (key) {
		case "scout_badge":
			return { scoutBadge: true };
		case "ambassador_badge":
			return { ambassadorBadge: true };
		case "connector_frame":
			return { connectorFrame: true };
		default:
			return null;
	}
}

/** Count referrals that completed email verification + onboarding for a referrer. */
export async function countQualifiedReferralsForUser(
	referrerUserId: string,
): Promise<number> {
	const [row] = await db
		.select({ total: count() })
		.from(patronReferral)
		.where(
			and(
				eq(patronReferral.referrerUserId, referrerUserId),
				eq(patronReferral.status, "qualified"),
			),
		);
	return Number(row?.total ?? 0);
}

async function hasFulfilledMilestone(
	userId: string,
	milestoneKey: ReferralMilestoneKey,
): Promise<boolean> {
	const [row] = await db
		.select({ id: patronReferralReward.id })
		.from(patronReferralReward)
		.where(
			and(
				eq(patronReferralReward.userId, userId),
				eq(patronReferralReward.milestoneKey, milestoneKey),
			),
		)
		.limit(1);
	return Boolean(row);
}

async function applyPlanOverrideReward(
	userId: string,
	milestoneKey: ReferralMilestoneKey,
	rewardTier: PlanTierId,
): Promise<void> {
	const [profileRow] = await db
		.select({
			subscriptionTier: profile.subscriptionTier,
			planOverride: profile.planOverride,
			preferences: profile.preferences,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!profileRow) return;

	const subscriptionTier = parsePlanTierId(profileRow.subscriptionTier);
	const currentOverride =
		profileRow.planOverride == null || profileRow.planOverride === ""
			? null
			: parsePlanTierId(profileRow.planOverride);
	const effectiveTier = resolveEffectiveTier({
		subscriptionTier,
		planOverride: currentOverride,
	});

	const rewardDays = SUBSCRIPTION_REWARD_DAYS[milestoneKey];
	const permanent = milestoneKey === "immersed_life";
	const shouldApplyOverride =
		permanent || tierRank(rewardTier) > tierRank(effectiveTier);

	const metadata: Record<string, unknown> = {
		milestoneKey,
		rewardTier,
		permanent,
	};
	if (rewardDays != null) {
		metadata.expiresAt = new Date(
			Date.now() + rewardDays * 24 * 60 * 60 * 1000,
		).toISOString();
	}

	if (shouldApplyOverride) {
		const nextOverride = permanent
			? rewardTier
			: tierRank(rewardTier) > tierRank(currentOverride ?? "still")
				? rewardTier
				: currentOverride;

		await db
			.update(profile)
			.set({
				planOverride: nextOverride,
				updatedAt: new Date(),
			})
			.where(eq(profile.userId, userId));
	}

	await db.insert(patronReferralReward).values({
		id: makeId("prr"),
		userId,
		milestoneKey,
		rewardType: permanent ? "plan_override_permanent" : "plan_override",
		metadata,
	});
}

async function applyIdentityReward(
	userId: string,
	milestoneKey: ReferralMilestoneKey,
	patch: ReferralRewardsPref,
): Promise<void> {
	const [profileRow] = await db
		.select({ preferences: profile.preferences })
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!profileRow) return;

	const preferences = mergeReferralRewardsPref(
		(profileRow.preferences as Record<string, unknown> | null) ?? null,
		patch,
	);

	await db
		.update(profile)
		.set({ preferences, updatedAt: new Date() })
		.where(eq(profile.userId, userId));

	await db.insert(patronReferralReward).values({
		id: makeId("prr"),
		userId,
		milestoneKey,
		rewardType: milestoneRewardType(milestoneKey),
		metadata: { patch },
	});
}

/** Fulfill one milestone if newly earned — idempotent per user + milestone key. */
export async function fulfillReferralMilestoneIfEligible(
	referrerUserId: string,
	milestoneKey: ReferralMilestoneKey,
	qualifiedCount: number,
): Promise<boolean> {
	const milestone = REFERRAL_MILESTONES.find((row) => row.key === milestoneKey);
	if (!milestone || qualifiedCount < milestone.qualifiedCount) return false;
	if (await hasFulfilledMilestone(referrerUserId, milestoneKey)) return false;

	const identityPatch = identityRewardPatch(milestoneKey);
	if (identityPatch) {
		await applyIdentityReward(referrerUserId, milestoneKey, identityPatch);
	} else {
		const rewardTier = milestonePlanTier(milestoneKey);
		if (!rewardTier) return false;
		await applyPlanOverrideReward(referrerUserId, milestoneKey, rewardTier);
	}

	const milestoneLabel = milestone.label;
	await deliverNotification({
		userId: referrerUserId,
		kind: "referral.milestone",
		title: "Referral milestone unlocked",
		body: `You earned ${milestoneLabel} — thanks for growing Sense.`,
		payload: { milestoneKey, qualifiedCount },
	});

	return true;
}

/** Evaluate the full ladder after a referral qualifies. */
export async function evaluateReferralMilestones(
	referrerUserId: string,
): Promise<void> {
	const qualifiedCount = await countQualifiedReferralsForUser(referrerUserId);
	for (const milestone of REFERRAL_MILESTONES) {
		await fulfillReferralMilestoneIfEligible(
			referrerUserId,
			milestone.key,
			qualifiedCount,
		);
	}
}

export type ReferralMilestoneState = "locked" | "next" | "earned";

/** Build milestone progress for Invite & earn UI. */
export async function buildReferralMilestoneProgress(
	referrerUserId: string,
	qualifiedCount: number,
): Promise<
	Array<{
		key: ReferralMilestoneKey;
		label: string;
		requiredCount: number;
		state: ReferralMilestoneState;
		earnedAt: string | null;
	}>
> {
	const earnedRows = await db
		.select({
			milestoneKey: patronReferralReward.milestoneKey,
			fulfilledAt: patronReferralReward.fulfilledAt,
		})
		.from(patronReferralReward)
		.where(eq(patronReferralReward.userId, referrerUserId));

	const earnedAtByKey = new Map<string, string>();
	for (const row of earnedRows) {
		earnedAtByKey.set(
			row.milestoneKey,
			row.fulfilledAt?.toISOString?.() ?? String(row.fulfilledAt),
		);
	}

	let nextAssigned = false;
	return REFERRAL_MILESTONES.map((milestone) => {
		if (earnedAtByKey.has(milestone.key)) {
			return {
				key: milestone.key,
				label: milestone.label,
				requiredCount: milestone.qualifiedCount,
				state: "earned" as const,
				earnedAt: earnedAtByKey.get(milestone.key) ?? null,
			};
		}
		if (!nextAssigned && qualifiedCount < milestone.qualifiedCount) {
			nextAssigned = true;
			return {
				key: milestone.key,
				label: milestone.label,
				requiredCount: milestone.qualifiedCount,
				state: "next" as const,
				earnedAt: null,
			};
		}
		return {
			key: milestone.key,
			label: milestone.label,
			requiredCount: milestone.qualifiedCount,
			state: "locked" as const,
			earnedAt: null,
		};
	});
}
