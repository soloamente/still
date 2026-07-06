import type { PlanTierId } from "@still/plans";
import { tierRank } from "@still/plans";

/** True when the patron should change plans via Polar portal, not a new checkout. */
export function canManagePolarBilling(input: {
	polarSubscriptionId?: string | null;
	subscriptionTier?: PlanTierId | null;
	subscriptionStatus?: string | null;
}): boolean {
	const polarSubscriptionId = input.polarSubscriptionId?.trim() ?? "";
	const subscriptionTier = input.subscriptionTier ?? "still";
	const subscriptionStatus = input.subscriptionStatus;

	return (
		polarSubscriptionId.length > 0 ||
		(subscriptionTier !== "still" &&
			(subscriptionStatus === "active" || subscriptionStatus === "past_due"))
	);
}

/** Pricing tier card CTA when the viewer already has Polar billing. */
export function pricingTierCtaLabel(
	targetTier: PlanTierId,
	viewerEffectiveTier: PlanTierId | null,
): string {
	const currentRank = tierRank(viewerEffectiveTier ?? "still");
	const targetRank = tierRank(targetTier);
	return targetRank > currentRank ? "Upgrade" : "Switch plan";
}
