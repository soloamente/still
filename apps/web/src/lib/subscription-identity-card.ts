import type { PlanTierId } from "@still/plans";

/** Patron-facing tier names for billing + identity copy. */
export const SUBSCRIPTION_TIER_LABELS: Record<PlanTierId, string> = {
	still: "Still",
	attuned: "Attuned",
	immersed: "Immersed",
	devoted: "Devoted",
};

export const SUBSCRIPTION_TIER_TAGLINES: Record<PlanTierId, string> = {
	still: "Quiet foundation — always free",
	attuned: "Know yourself as a watcher",
	immersed: "Expression, social depth, engagement layer",
	devoted: "You helped build this",
};

/**
 * Membership-card specular / drop-shadow hue by plan rarity.
 * Aligned with avatar aura rim hues (warm Attuned → Immersed gold; Devoted magenta).
 */
export const SUBSCRIPTION_IDENTITY_GLOW_COLOR: Record<PlanTierId, string> = {
	// Still stays mid-chrome — high L reads as a white bloom on light shells.
	still: "oklch(0.52 0.025 250)",
	attuned: "oklch(0.72 0.12 68)",
	immersed: "oklch(0.78 0.14 78)",
	devoted: "oklch(0.72 0.16 320)",
};

/** Secondary iridescent stop for Devoted only — matches avatar aura cool arm. */
export const SUBSCRIPTION_IDENTITY_GLOW_COLOR_SECONDARY: Partial<
	Record<PlanTierId, string>
> = {
	devoted: "oklch(0.7 0.12 200)",
};

/** Face specular mix % — stronger wash as rarity climbs. */
export const SUBSCRIPTION_IDENTITY_GLOW_FACE_MIX: Record<PlanTierId, number> = {
	still: 6,
	attuned: 11,
	immersed: 14,
	devoted: 16,
};

/** Outer drop-shadow mix % on hover only — rest state stays flat (no white haze). */
export const SUBSCRIPTION_IDENTITY_GLOW_SHADOW_MIX: Record<PlanTierId, number> =
	{
		still: 12,
		attuned: 18,
		immersed: 22,
		devoted: 26,
	};

export function subscriptionIdentityGlowColor(tier: PlanTierId): string {
	return SUBSCRIPTION_IDENTITY_GLOW_COLOR[tier];
}

/**
 * Distinct membership-card chrome per plan — not a single recolored glow.
 * CSS class suffix on `.subscription-card-fx--*`.
 */
export type SubscriptionIdentityCardFx =
	| "still"
	| "attuned"
	| "immersed"
	| "devoted";

export function subscriptionIdentityCardFx(
	tier: PlanTierId,
): SubscriptionIdentityCardFx {
	switch (tier) {
		case "still":
			return "still";
		case "attuned":
			return "attuned";
		case "immersed":
			return "immersed";
		case "devoted":
			return "devoted";
		default: {
			const _exhaustive: never = tier;
			return _exhaustive;
		}
	}
}

export type SubscriptionBillingStatus =
	| "active"
	| "past_due"
	| "canceled"
	| null;

export function subscriptionStatusBadgeCopy(
	status: SubscriptionBillingStatus,
): {
	label: string;
	className: string;
} {
	switch (status) {
		case "active":
			return {
				label: "Active",
				className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
			};
		case "past_due":
			return {
				label: "Payment issue",
				className: "bg-desert-orange/15 text-desert-orange",
			};
		case "canceled":
			return {
				label: "Canceled",
				className: "bg-muted text-muted-foreground",
			};
		case null:
			return {
				label: "Free",
				className: "bg-background text-muted-foreground",
			};
		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}

export function formatSubscriptionBillingInterval(
	interval: "month" | "year" | null | undefined,
): string | null {
	if (interval === "month") return "Monthly billing";
	if (interval === "year") return "Annual billing";
	return null;
}
