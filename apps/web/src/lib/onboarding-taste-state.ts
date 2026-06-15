import { ONBOARDING_TASTE_MIN_RATED } from "./onboarding-types";

/** Count diary ratings collected during onboarding quick-rate. */
export function countOnboardingTasteRated(
	ratings: Record<number, number>,
	_skipped: ReadonlySet<number>,
): number {
	return Object.keys(ratings).length;
}

export function isOnboardingTasteSkipped(
	movieId: number,
	skipped: ReadonlySet<number>,
): boolean {
	return skipped.has(movieId);
}

export function canAdvanceOnboardingTaste(
	ratings: Record<number, number>,
	skipped: ReadonlySet<number>,
	minRated = ONBOARDING_TASTE_MIN_RATED,
): boolean {
	return countOnboardingTasteRated(ratings, skipped) >= minRated;
}
