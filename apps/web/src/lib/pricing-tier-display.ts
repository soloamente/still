import type { PlanTierId } from "@still/plans";

import type { PublicPlanFeature, PublicPlanTier } from "./fetch-public-plans";

/** Catalogue order — used to diff each card against the tier below. */
export const PRICING_TIER_ORDER: readonly PlanTierId[] = [
	"still",
	"attuned",
	"immersed",
	"devoted",
] as const;

/** Recommended paid tier — Mobbin-style "Popular" highlight on cards + compare table. */
export const PRICING_POPULAR_TIER_ID: PlanTierId = "immersed";

export type PricingComparisonSection = {
	id: PlanTierId;
	label: string;
	features: PublicPlanFeature[];
};

function featureIdentity(feature: PublicPlanFeature): string {
	return feature.key ?? feature.name;
}

/** Tier id immediately below `tierId`, if any. */
export function previousPricingTierId(tierId: string): PlanTierId | null {
	const index = PRICING_TIER_ORDER.indexOf(tierId as PlanTierId);
	if (index <= 0) return null;
	return PRICING_TIER_ORDER[index - 1] ?? null;
}

/**
 * Features to list on a tier card — Still shows its foundation rows; paid tiers
 * pair with {@link pricingTierIncludesFeatureLabel} and only surface features
 * whose catalogue minimum tier is this column (Mobbin "All X features" + deltas).
 */
export function incrementalPricingFeatures(
	tier: PublicPlanTier,
	allTiers: PublicPlanTier[],
): PublicPlanFeature[] {
	const previousId = previousPricingTierId(tier.id);
	if (!previousId) {
		return [...tier.features].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	return tier.features
		.filter((feature) => {
			const minTier = minimumTierForFeature(feature, allTiers);
			return minTier === (tier.id as PlanTierId);
		})
		.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Mobbin-style rollup row — "All Immersed features". */
export function pricingTierIncludesFeatureLabel(
	tier: PublicPlanTier,
	allTiers: PublicPlanTier[],
): string | null {
	const previousId = previousPricingTierId(tier.id);
	if (!previousId) return null;

	const previousTier = allTiers.find((row) => row.id === previousId);
	if (!previousTier) return null;

	return `All ${previousTier.name} features`;
}

/** Whether a catalogue row is included on a given tier column. */
export function tierIncludesFeature(
	tierId: PlanTierId,
	feature: PublicPlanFeature,
	allTiers: PublicPlanTier[],
): boolean {
	const tier = allTiers.find((row) => row.id === tierId);
	if (!tier) return false;
	const identity = featureIdentity(feature);
	return tier.features.some((row) => featureIdentity(row) === identity);
}

/** Lowest tier where a feature first appears — drives compare-table section headers. */
export function minimumTierForFeature(
	feature: PublicPlanFeature,
	allTiers: PublicPlanTier[],
): PlanTierId {
	for (const tierId of PRICING_TIER_ORDER) {
		if (tierIncludesFeature(tierId, feature, allTiers)) {
			return tierId;
		}
	}
	return "still";
}

/** Union of all features across tiers, grouped by first tier unlocked. */
export function buildPricingComparisonSections(
	allTiers: PublicPlanTier[],
): PricingComparisonSection[] {
	const seen = new Set<string>();
	const byTier = new Map<PlanTierId, PublicPlanFeature[]>();

	for (const tierId of PRICING_TIER_ORDER) {
		byTier.set(tierId, []);
	}

	for (const tier of [...allTiers].sort((a, b) => a.sortOrder - b.sortOrder)) {
		for (const feature of tier.features) {
			const identity = featureIdentity(feature);
			if (seen.has(identity)) continue;
			seen.add(identity);
			const sectionId = minimumTierForFeature(feature, allTiers);
			byTier.get(sectionId)?.push(feature);
		}
	}

	return PRICING_TIER_ORDER.map((tierId) => {
		const tier = allTiers.find((row) => row.id === tierId);
		return {
			id: tierId,
			label: tier?.name ?? tierId,
			features: (byTier.get(tierId) ?? []).sort(
				(a, b) => a.sortOrder - b.sortOrder,
			),
		};
	}).filter((section) => section.features.length > 0);
}

/** Annual vs monthly savings when both prices exist (Mobbin "Save 33%" copy). */
export function pricingAnnualSavingsPercent(
	tier: PublicPlanTier,
): number | null {
	if (tier.priceMonthlyCents == null || tier.priceYearlyCents == null) {
		return null;
	}
	const monthlyAnnualized = tier.priceMonthlyCents * 12;
	if (monthlyAnnualized <= tier.priceYearlyCents) return null;
	return Math.round((1 - tier.priceYearlyCents / monthlyAnnualized) * 100);
}

/** Largest annual savings across purchasable tiers — hero hint under interval toggle. */
export function pricingMaxAnnualSavingsPercent(
	tiers: PublicPlanTier[],
): number | null {
	let max: number | null = null;
	for (const tier of tiers) {
		if (!tier.purchasable) continue;
		const savings = pricingAnnualSavingsPercent(tier);
		if (savings == null) continue;
		max = max == null ? savings : Math.max(max, savings);
	}
	return max;
}

type BillingInterval = "month" | "year";

/** Fallback slugs when the plans API response is stale — mirrors `plans-public.ts`. */
const PRICING_CHECKOUT_SLUGS: Record<
	string,
	{ monthly: string; yearly: string }
> = {
	attuned: { monthly: "attuned-monthly", yearly: "attuned-yearly" },
	immersed: { monthly: "immersed-monthly", yearly: "immersed-yearly" },
	devoted: { monthly: "devoted-monthly", yearly: "devoted-yearly" },
};

/** Resolve Polar checkout slug for a tier card CTA. */
export function pricingTierCheckoutSlug(
	tier: Pick<PublicPlanTier, "id" | "checkoutSlugs">,
	interval: BillingInterval,
): string | null {
	const key = interval === "month" ? "monthly" : "yearly";
	return (
		tier.checkoutSlugs?.[key] ?? PRICING_CHECKOUT_SLUGS[tier.id]?.[key] ?? null
	);
}

/** Whether the pricing card should show a paid subscribe CTA. */
export function pricingTierHasCheckoutCta(
	tier: Pick<PublicPlanTier, "id" | "purchasable">,
): boolean {
	return tier.purchasable || tier.id === "devoted";
}
