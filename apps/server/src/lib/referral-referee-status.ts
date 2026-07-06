import { db, patronReferral, profile } from "@still/db";
import { eq } from "drizzle-orm";

import { resolveReferralCheckoutDiscountId } from "./referral-checkout-discount";

export type ReferralRefereeStatus = {
	/** Patron may POST /api/referrals/capture — no referrer linked yet. */
	canApplyReferralCode: boolean;
	/** 10% Polar discount applies on next Attuned / Immersed checkout. */
	referralDiscountEligible: boolean;
	/** Friend discount was consumed on a prior checkout. */
	referralDiscountRedeemed: boolean;
};

/** Pure gate — blocks capture when a referrer or referee row already exists. */
export function canPatronApplyReferralCode(input: {
	referredByUserId: string | null | undefined;
	hasRefereeReferralRow: boolean;
}): boolean {
	if (input.referredByUserId?.trim()) return false;
	if (input.hasRefereeReferralRow) return false;
	return true;
}

/** Signed-in referee state for pricing / settings upsell surfaces. */
export async function fetchReferralRefereeStatusForUser(
	userId: string,
): Promise<ReferralRefereeStatus | null> {
	const [profileRow] = await db
		.select({
			referredByUserId: profile.referredByUserId,
			referralDiscountRedeemed: profile.referralDiscountRedeemed,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!profileRow) return null;

	const [referralRow] = await db
		.select({ id: patronReferral.id })
		.from(patronReferral)
		.where(eq(patronReferral.refereeUserId, userId))
		.limit(1);

	const discountId = resolveReferralCheckoutDiscountId({
		referredByUserId: profileRow.referredByUserId,
		referralDiscountRedeemed: profileRow.referralDiscountRedeemed,
	});

	return {
		canApplyReferralCode: canPatronApplyReferralCode({
			referredByUserId: profileRow.referredByUserId,
			hasRefereeReferralRow: Boolean(referralRow),
		}),
		referralDiscountEligible: discountId != null,
		referralDiscountRedeemed: profileRow.referralDiscountRedeemed,
	};
}
