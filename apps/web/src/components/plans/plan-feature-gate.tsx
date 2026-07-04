"use client";

import {
	MIN_TIER_FOR_FEATURE,
	type PlanFeatureKey,
	type PlanTierId,
} from "@still/plans";
import Link from "next/link";
import type { ReactNode } from "react";

import { usePatronEntitlements } from "@/components/plans/use-patron-entitlements";

/** Patron-facing labels for upsell lock cards. */
const PLAN_FEATURE_LABELS: Record<PlanFeatureKey, string> = {
	full_stats: "Full stats",
	taste_signature: "Taste signature",
	activity_signature: "Activity signature",
	streaming_filters: "Streaming filters",
	watchlist_alerts: "Watchlist alerts",
	all_themes: "All themes",
	profile_customization: "Profile customization",
	pinned_reviews: "Pinned reviews",
	list_covers: "List covers",
	private_lists: "Private lists",
	taste_overlap: "Taste overlap",
	badge_prestige: "Badge prestige",
	challenges: "Challenges",
	leaderboard_visibility: "Leaderboard visibility",
};

/** Minimum tier label for pricing upsell copy. */
export function requiredTierLabelForFeature(
	featureKey: PlanFeatureKey,
): "Attuned" | "Immersed" | "Devoted" {
	const tier = MIN_TIER_FOR_FEATURE[featureKey];
	switch (tier) {
		case "attuned":
			return "Attuned";
		case "immersed":
			return "Immersed";
		case "devoted":
			return "Devoted";
		default: {
			const _exhaustive: never = tier;
			return _exhaustive;
		}
	}
}

function pricingHashForTier(tier: PlanTierId): string {
	switch (tier) {
		case "attuned":
			return "attuned";
		case "immersed":
			return "immersed";
		case "devoted":
			return "devoted";
		default:
			return "immersed";
	}
}

function planFeatureLabel(featureKey: PlanFeatureKey): string {
	return PLAN_FEATURE_LABELS[featureKey];
}

type PlanFeatureGateProps = {
	featureKey: PlanFeatureKey;
	/** Override tier label in lock card — defaults from {@link requiredTierLabelForFeature}. */
	requiredTierLabel?: string;
	children: ReactNode;
};

/** Renders children when entitled; otherwise a compact upsell lock card. */
export function PlanFeatureGate({
	featureKey,
	requiredTierLabel,
	children,
}: PlanFeatureGateProps) {
	const { hasFeature } = usePatronEntitlements();

	if (hasFeature(featureKey)) {
		return children;
	}

	const tierLabel =
		requiredTierLabel ?? requiredTierLabelForFeature(featureKey);
	const minTier = MIN_TIER_FOR_FEATURE[featureKey];
	const pricingHref = `/pricing#${pricingHashForTier(minTier)}`;

	return (
		<div className="rounded-2xl bg-background p-4 text-sm">
			<p className="font-medium text-foreground">
				{planFeatureLabel(featureKey)}
			</p>
			<p className="mt-1 text-muted-foreground leading-relaxed">
				Included with {tierLabel}.{" "}
				<Link
					href={pricingHref}
					className="font-medium text-foreground underline-offset-4 [@media(hover:hover)]:hover:underline"
				>
					View plans
				</Link>
			</p>
		</div>
	);
}
