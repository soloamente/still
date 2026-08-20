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

/**
 * Legacy patrons finished onboarding before v3 persisted `onboarded_at`.
 * Post-v3 patrons must stay gated until explicit `markOnboarded` (Enter / skip) —
 * favorites, taste recompute, and diary logs from the wizard must not unlock `/home`
 * while import / done are still unfinished.
 */
export function shouldGrandfatherLegacyOnboarding(
	profile: GrandfatherProfileRow,
	_diaryLogCount: number,
): boolean {
	if (profile.onboardedAt != null) return false;
	if (!profile.handle?.trim()) return false;

	return profile.createdAt < ONBOARDING_V3_LAUNCH_AT;
}

/** Timestamp to persist when grandfathering — prefer last profile activity. */
export function grandfatherOnboardedTimestamp(
	profile: GrandfatherProfileRow,
): Date {
	return profile.updatedAt ?? profile.createdAt;
}
