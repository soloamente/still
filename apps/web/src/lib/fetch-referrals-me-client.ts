import { stillApiOrigin } from "@/lib/still-api-origin";

export type ReferralMilestoneState = "locked" | "next" | "earned";

export type ReferralsMeMilestone = {
	key: string;
	label: string;
	requiredCount: number;
	state: ReferralMilestoneState;
	earnedAt: string | null;
};

export type ReferralsMeResponse = {
	referralCode: string;
	/** Primary share link — `/?ref=` marketing entry. */
	referralUrl: string;
	/** Direct sign-up deep link when a CTA should skip the landing page. */
	referralSignUpUrl?: string;
	qualifiedCount: number;
	pendingCount: number;
	milestones: ReferralsMeMilestone[];
};

/** Signed-in patron referral link + milestone progress for Invite & earn UI. */
export async function fetchReferralsMeClient(): Promise<ReferralsMeResponse> {
	const response = await fetch(`${stillApiOrigin()}/api/referrals/me`, {
		credentials: "include",
		cache: "no-store",
	});

	if (!response.ok) {
		const message =
			response.status === 401
				? "Sign in to view your referral link"
				: "Could not load referral details";
		throw new Error(message);
	}

	return (await response.json()) as ReferralsMeResponse;
}
