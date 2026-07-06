import { stillApiOrigin } from "@/lib/still-api-origin";

export type PublicPlanFeature = {
	key: string | null;
	name: string;
	description: string;
	buildStatus: string;
	sortOrder: number;
};

export type PublicPlanTier = {
	id: string;
	name: string;
	tagline: string;
	sortOrder: number;
	priceMonthlyCents: number | null;
	priceYearlyCents: number | null;
	purchasable: boolean;
	checkoutSlugs: { monthly: string; yearly: string } | null;
	features: PublicPlanFeature[];
};

export type PublicPlansPayload = {
	tiers: PublicPlanTier[];
};

/** Server + client fetch for the public pricing catalogue. */
export async function fetchPublicPlans(options?: {
	/** Pricing page uses `no-store` so tier CTAs stay in sync with Polar config. */
	cache?: RequestCache;
}): Promise<PublicPlansPayload> {
	const res = await fetch(`${stillApiOrigin()}/api/plans`, {
		...(options?.cache === "no-store"
			? { cache: "no-store" as const }
			: { next: { revalidate: 3600 } }),
	});
	if (!res.ok) {
		throw new Error(`Failed to load plans (${res.status})`);
	}
	return res.json() as Promise<PublicPlansPayload>;
}

/** Format plan prices stored as cents in `plan_tier`. */
export function formatPlanPriceCents(cents: number): string {
	const dollars = cents / 100;
	if (Number.isInteger(dollars)) {
		return `$${dollars}`;
	}
	return `$${dollars.toFixed(2)}`;
}
