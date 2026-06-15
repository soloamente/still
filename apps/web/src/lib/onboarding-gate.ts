/** Profile fields used to decide if `/onboarding` is still required. */

export type OnboardingGateProfile = {
	onboardedAt?: string | Date | null;

	handle?: string | null;

	createdAt?: string | Date | null;

	tasteSignatureComputedAt?: string | Date | null;

	favoriteMovieIds?: readonly unknown[] | null;

	/** Non-null when the patron has at least one diary log (from GET /profiles/me). */

	diaryMetalTier?: string | null;
} | null;

/** Wizard v3 launch — profiles created before this with a handle are legacy-complete. */

export const ONBOARDING_V3_LAUNCH_AT = new Date("2026-06-14T00:00:00.000Z");

function toDate(value: string | Date | null | undefined): Date | null {
	if (value == null) return null;

	if (value instanceof Date) return value;

	const parsed = new Date(value);

	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function favoriteMovieCount(
	raw: readonly unknown[] | null | undefined,
): number {
	return raw?.length ?? 0;
}

/**

 * Pre-v3 patrons often have a handle but never received `onboarded_at`.

 * Mid-wizard v3 patrons (handle saved, same-day signup) stay gated.

 */

export function isLegacyOnboardingComplete(
	profile: NonNullable<OnboardingGateProfile>,
): boolean {
	if (!profile.handle?.trim()) return false;

	const createdAt = toDate(profile.createdAt);

	if (createdAt && createdAt < ONBOARDING_V3_LAUNCH_AT) return true;

	if (toDate(profile.tasteSignatureComputedAt)) return true;

	if (favoriteMovieCount(profile.favoriteMovieIds) > 0) return true;

	if (profile.diaryMetalTier != null) return true;

	return false;
}

/**

 * Patrons must not enter `(app)` until onboarding sets `onboardedAt`

 * (`markOnboarded` on finish). Handle alone is saved mid-wizard and is not enough.

 */

export function patronNeedsOnboarding(profile: OnboardingGateProfile): boolean {
	if (!profile) return true;

	if (profile.onboardedAt != null && profile.onboardedAt !== "") return false;

	return !isLegacyOnboardingComplete(profile);
}

/** Resume full setup after a mid-wizard redirect (handle already persisted). */

export function resolveOnboardingResumeStep(
	savedHandle: string,
): "welcome" | "bio" {
	return savedHandle.trim() ? "bio" : "welcome";
}
