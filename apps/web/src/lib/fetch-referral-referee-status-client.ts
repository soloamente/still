import { stillApiOrigin } from "@/lib/still-api-origin";

export type ReferralRefereeStatus = {
	canApplyReferralCode: boolean;
	referralDiscountEligible: boolean;
	referralDiscountRedeemed: boolean;
};

/** Signed-in referee eligibility — apply friend code or checkout discount state. */
export async function fetchReferralRefereeStatusClient(): Promise<ReferralRefereeStatus | null> {
	const response = await fetch(
		`${stillApiOrigin()}/api/referrals/referee-status`,
		{
			credentials: "include",
			cache: "no-store",
		},
	);

	if (response.status === 401) return null;
	if (!response.ok) {
		throw new Error("Could not load referral status");
	}

	return (await response.json()) as ReferralRefereeStatus;
}
