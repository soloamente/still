/** Profiles created before wizard v3 shipped without `onboarded_at` are treated as complete. */
export const ONBOARDING_V3_LAUNCH_AT = new Date("2026-06-14T00:00:00.000Z");

type GrandfatherProfileRow = {
	handle: string | null;
	onboardedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	tasteSignatureComputedAt: Date | null;
	favoriteMovieIds: unknown;
};

function favoriteMovieCount(raw: unknown): number {
	if (!Array.isArray(raw)) return 0;
	return raw.length;
}

/**
 * Legacy patrons finished onboarding before v3 persisted `onboarded_at`.
 * New v3 sign-ups mid-wizard (handle only, same day) must stay gated.
 */
export function shouldGrandfatherLegacyOnboarding(
	profile: GrandfatherProfileRow,
	diaryLogCount: number,
): boolean {
	if (profile.onboardedAt != null) return false;
	if (!profile.handle?.trim()) return false;

	if (profile.createdAt < ONBOARDING_V3_LAUNCH_AT) return true;
	if (profile.tasteSignatureComputedAt != null) return true;
	if (favoriteMovieCount(profile.favoriteMovieIds) > 0) return true;
	if (diaryLogCount > 0) return true;

	return false;
}

/** Timestamp to persist when grandfathering — prefer last profile activity. */
export function grandfatherOnboardedTimestamp(
	profile: GrandfatherProfileRow,
): Date {
	return profile.updatedAt ?? profile.createdAt;
}
