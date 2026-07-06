import { db, patronReferral, profile, user } from "@still/db";
import { and, eq } from "drizzle-orm";

import { deliverNotification } from "./notification-delivery";
import { syncProfileReferrerFromCapture } from "./referral-capture";
import { evaluateReferralMilestones } from "./referral-milestones";

export type ReferralQualifyResult =
	| { qualified: true; referrerUserId: string; referralId: string }
	| {
			qualified: false;
			reason:
				| "no_referral"
				| "already_qualified"
				| "void"
				| "pending_requirements";
	  };

/** Pure readiness check — email verified and onboarding complete. */
export function isReferralReadyToQualify(input: {
	emailVerified: boolean;
	onboardedAt: Date | null | undefined;
	status: string | null | undefined;
}): boolean {
	if (input.status !== "pending") return false;
	if (!input.emailVerified) return false;
	return input.onboardedAt != null;
}

/**
 * Promote a pending referral to qualified when the referee verified email and finished onboarding.
 * Safe to call repeatedly — no-ops when requirements are unmet or referral already qualified.
 */
export async function qualifyReferralForUser(
	refereeUserId: string,
): Promise<ReferralQualifyResult> {
	const [referralRow] = await db
		.select({
			id: patronReferral.id,
			referrerUserId: patronReferral.referrerUserId,
			status: patronReferral.status,
		})
		.from(patronReferral)
		.where(eq(patronReferral.refereeUserId, refereeUserId))
		.limit(1);

	if (!referralRow) {
		return { qualified: false, reason: "no_referral" };
	}

	if (referralRow.status === "qualified") {
		return { qualified: false, reason: "already_qualified" };
	}

	if (referralRow.status === "void") {
		return { qualified: false, reason: "void" };
	}

	const [userRow] = await db
		.select({ emailVerified: user.emailVerified })
		.from(user)
		.where(eq(user.id, refereeUserId))
		.limit(1);

	const [profileRow] = await db
		.select({ onboardedAt: profile.onboardedAt })
		.from(profile)
		.where(eq(profile.userId, refereeUserId))
		.limit(1);

	if (
		!isReferralReadyToQualify({
			emailVerified: userRow?.emailVerified === true,
			onboardedAt: profileRow?.onboardedAt,
			status: referralRow.status,
		})
	) {
		return { qualified: false, reason: "pending_requirements" };
	}

	const qualifiedAt = new Date();
	await db
		.update(patronReferral)
		.set({ status: "qualified", qualifiedAt })
		.where(
			and(
				eq(patronReferral.id, referralRow.id),
				eq(patronReferral.status, "pending"),
			),
		);

	await syncProfileReferrerFromCapture(refereeUserId);

	const [refereeProfile] = await db
		.select({ displayName: profile.displayName, handle: profile.handle })
		.from(profile)
		.where(eq(profile.userId, refereeUserId))
		.limit(1);

	const refereeLabel =
		refereeProfile?.displayName?.trim() ||
		(refereeProfile?.handle
			? `@${refereeProfile.handle}`
			: "Someone you invited");

	await deliverNotification({
		userId: referralRow.referrerUserId,
		kind: "referral.qualified",
		title: "Your invite joined Sense",
		body: `${refereeLabel} finished onboarding — your referral count just went up.`,
		payload: {
			refereeUserId,
			referralId: referralRow.id,
		},
		context: { actorUserId: refereeUserId },
	});

	await evaluateReferralMilestones(referralRow.referrerUserId);

	return {
		qualified: true,
		referrerUserId: referralRow.referrerUserId,
		referralId: referralRow.id,
	};
}
