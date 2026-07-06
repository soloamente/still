import { hasPatronFeatureForTier, type PlanFeatureKey } from "@still/plans";

import type { PatronEntitlements } from "./patron-entitlements";

/** Attuned+ watch-type filters beyond default subscription streaming. */
const PREMIUM_STREAMING_MONETIZATION = new Set(["rent", "buy", "free", "ads"]);

/** UTC calendar year — used for Still-tier annual Wrapped snapshot access. */
export function currentUtcCalendarYear(): number {
	return new Date().getUTCFullYear();
}

/** True when the patron may request on-demand Wrapped for any calendar year. */
export function canAccessYearInReviewYear(
	year: number,
	entitlements: Pick<PatronEntitlements, "effectiveTier" | "featureGrants">,
): boolean {
	if (
		hasPatronFeatureForTier({
			effectiveTier: entitlements.effectiveTier,
			grants: entitlements.featureGrants,
			featureKey: "full_stats",
		})
	) {
		return true;
	}
	return year === currentUtcCalendarYear();
}

/** Rent / buy / free / ads catalogue filters — Attuned feature (`streaming_filters`). */
export function isPremiumStreamingMonetizationFilter(
	raw: string | null | undefined,
): boolean {
	const normalized = (raw ?? "").trim().toLowerCase();
	return PREMIUM_STREAMING_MONETIZATION.has(normalized);
}

/** Force watchlist alert pref off when the patron lacks `watchlist_alerts`. */
export function sanitizeWatchlistStreamingAlertsPreference(
	preferences: Record<string, unknown>,
	entitlements: Pick<PatronEntitlements, "effectiveTier" | "featureGrants">,
): Record<string, unknown> {
	if (patronHasPlanFeature(entitlements, "watchlist_alerts")) {
		return preferences;
	}
	if (preferences.watchlistStreamingAlerts === true) {
		return { ...preferences, watchlistStreamingAlerts: false };
	}
	return preferences;
}

/** Standard 403 body for plan-gated API routes. */
export function planFeatureRequiredBody(
	featureKey: PlanFeatureKey,
	message: string,
) {
	return {
		error: message,
		code: "PLAN_FEATURE_REQUIRED" as const,
		featureKey,
	};
}

/** Shared entitlement check for plan-gated surfaces. */
export function patronHasPlanFeature(
	entitlements: Pick<PatronEntitlements, "effectiveTier" | "featureGrants">,
	featureKey: PlanFeatureKey,
): boolean {
	return hasPatronFeatureForTier({
		effectiveTier: entitlements.effectiveTier,
		grants: entitlements.featureGrants,
		featureKey,
	});
}
