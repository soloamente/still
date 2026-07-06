import { db, profile } from "@still/db";
import { env } from "@still/env/server";
import { eq } from "drizzle-orm";

/** Pure eligibility — referred patrons get one 10% checkout discount. */
export function isReferralCheckoutDiscountEligible(input: {
	referredByUserId: string | null | undefined;
	referralDiscountRedeemed: boolean;
	discountIdConfigured: boolean;
}): boolean {
	if (!input.discountIdConfigured) return false;
	if (!input.referredByUserId?.trim()) return false;
	return !input.referralDiscountRedeemed;
}

/** Resolve Polar discount id when the patron is referral-eligible. */
export function resolveReferralCheckoutDiscountId(input: {
	referredByUserId: string | null | undefined;
	referralDiscountRedeemed: boolean;
	/** Test override — defaults to `POLAR_DISCOUNT_REFERRAL10`. */
	configuredDiscountId?: string | null;
}): string | null {
	const discountId =
		input.configuredDiscountId?.trim() ||
		env.POLAR_DISCOUNT_REFERRAL10?.trim() ||
		null;
	if (
		!isReferralCheckoutDiscountEligible({
			referredByUserId: input.referredByUserId,
			referralDiscountRedeemed: input.referralDiscountRedeemed,
			discountIdConfigured: Boolean(discountId),
		})
	) {
		return null;
	}
	return discountId;
}

/** Load profile referral fields and return checkout discount id when eligible. */
export async function fetchReferralCheckoutDiscountForUser(
	userId: string,
): Promise<string | null> {
	const [row] = await db
		.select({
			referredByUserId: profile.referredByUserId,
			referralDiscountRedeemed: profile.referralDiscountRedeemed,
		})
		.from(profile)
		.where(eq(profile.userId, userId))
		.limit(1);

	if (!row) return null;

	return resolveReferralCheckoutDiscountId({
		referredByUserId: row.referredByUserId,
		referralDiscountRedeemed: row.referralDiscountRedeemed,
	});
}
