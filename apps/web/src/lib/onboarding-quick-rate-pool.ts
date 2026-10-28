/**
 * Editorial quick-rate pool for onboarding v2 (taste seeding).
 * TMDb ids — well-known films across genres for a short personality quiz.
 * The taste step draws a random subset per visit (see `pickOnboardingQuickRateIds`),
 * so the pool is intentionally larger than what one patron sees.
 */
export const ONBOARDING_QUICK_RATE_TMDB_IDS = [
	278, 155, 238, 680, 424, 129, 27205, 157336, 496243, 603, 550, 13, 769,
	346698, 106646, 76341, 313369, 324552, 493922, 399170,
	// Extra well-known titles for variety across sessions.
	98, 120, 11, 105, 244786, 372058, 354912, 335984, 438631, 872585, 569094,
	152601, 120467, 194, 862, 14160, 10681, 475557, 419430, 1124, 77, 807, 274,
	37165, 1422, 16869, 24, 49026, 4935, 12, 299536, 530385, 508442,
] as const;

/**
 * Random, de-duplicated sample of the pool (Fisher–Yates) so patrons don't
 * always see the same films by default. Call from client effects only —
 * the result differs per call, so don't render it during SSR.
 */
export function pickOnboardingQuickRateIds(count: number): number[] {
	const ids = [...new Set<number>(ONBOARDING_QUICK_RATE_TMDB_IDS)];
	for (let i = ids.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[ids[i], ids[j]] = [ids[j] as number, ids[i] as number];
	}
	return ids.slice(0, count);
}
