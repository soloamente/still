/** Nested key on `profile.preferences` for referral identity perks (badges, frames). */
export const PROFILE_PREF_REFERRAL_REWARDS = "referralRewards" as const;

export type ReferralRewardsPref = {
	scoutBadge?: boolean;
	ambassadorBadge?: boolean;
	connectorFrame?: boolean;
};

/** Merge earned referral identity perks into existing preferences JSON. */
export function mergeReferralRewardsPref(
	preferences: Record<string, unknown> | null | undefined,
	patch: ReferralRewardsPref,
): Record<string, unknown> {
	const next = { ...(preferences ?? {}) };
	const existing = next[PROFILE_PREF_REFERRAL_REWARDS];
	const merged: ReferralRewardsPref =
		existing != null && typeof existing === "object" && !Array.isArray(existing)
			? { ...(existing as ReferralRewardsPref), ...patch }
			: { ...patch };
	next[PROFILE_PREF_REFERRAL_REWARDS] = merged;
	return next;
}
