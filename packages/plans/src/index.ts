/** Canonical subscription tier identifiers for Sense plans. */
export const PLAN_TIER_IDS = [
	"still",
	"attuned",
	"immersed",
	"devoted",
] as const;
export type PlanTierId = (typeof PLAN_TIER_IDS)[number];

/** Feature keys gated by tier or staff grants — mirrors plan_feature.key in DB. */
export type PlanFeatureKey =
	| "full_stats"
	| "taste_signature"
	| "activity_signature"
	| "streaming_filters"
	| "watchlist_alerts"
	| "all_themes"
	| "profile_customization"
	| "pinned_reviews"
	| "list_covers"
	| "private_lists"
	| "taste_overlap"
	| "badge_prestige"
	| "challenges"
	| "leaderboard_visibility";

/** Numeric rank for tier comparison — higher tier includes lower-tier entitlements. */
const TIER_RANK: Record<PlanTierId, number> = {
	still: 0,
	attuned: 1,
	immersed: 2,
	devoted: 3,
};

export function tierRank(tier: PlanTierId): number {
	return TIER_RANK[tier];
}

/** Staff override takes precedence over Polar-synced subscription tier. */
export function resolveEffectiveTier(input: {
	subscriptionTier: PlanTierId;
	planOverride: PlanTierId | null;
}): PlanTierId {
	return input.planOverride ?? input.subscriptionTier ?? "still";
}

/** Grant-only extras unlock above tier; otherwise compare effective tier rank to minimum. */
export function hasPatronFeature(input: {
	effectiveTier: PlanTierId;
	grants: readonly PlanFeatureKey[];
	featureKey: PlanFeatureKey;
	minTierFor: Record<PlanFeatureKey, PlanTierId>;
}): boolean {
	if (input.grants.includes(input.featureKey)) return true;
	const minTier = input.minTierFor[input.featureKey];
	return tierRank(input.effectiveTier) >= tierRank(minTier);
}

/** Referral milestone ladder — config-only v1 */
export const REFERRAL_MILESTONES = [
	{ key: "scout_badge", qualifiedCount: 1, label: "Scout badge" },
	{ key: "attuned_1mo", qualifiedCount: 3, label: "1 month Attuned" },
	{ key: "connector_frame", qualifiedCount: 5, label: "Connector frame" },
	{ key: "immersed_1mo", qualifiedCount: 10, label: "1 month Immersed" },
	{ key: "ambassador_badge", qualifiedCount: 15, label: "Ambassador badge" },
	{ key: "immersed_3mo", qualifiedCount: 25, label: "3 months Immersed" },
	{ key: "immersed_life", qualifiedCount: 50, label: "Immersed for life" },
] as const;
