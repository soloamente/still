import { db, planFeature, planFeatureTier, planTier } from "@still/db";
import { asc } from "drizzle-orm";
import { Elysia } from "elysia";

/** Polar checkout slugs configured in `packages/auth/src/lib/polar-checkout-products.ts`. */
const CHECKOUT_SLUGS_BY_TIER: Record<
	string,
	{ monthly: string; yearly: string }
> = {
	attuned: { monthly: "attuned-monthly", yearly: "attuned-yearly" },
	immersed: { monthly: "immersed-monthly", yearly: "immersed-yearly" },
	devoted: { monthly: "devoted-monthly", yearly: "devoted-yearly" },
};

const PURCHASABLE_TIER_IDS = new Set(["attuned", "immersed", "devoted"]);

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

export type PublicPlansResponse = {
	tiers: PublicPlanTier[];
};

/**
 * Public catalogue for `/pricing` — tiers, grouped features, and Polar checkout slugs.
 * No auth required; only `exists` + `planned` features from the staff catalogue are exposed.
 */
export const plansPublicRoute = new Elysia({
	prefix: "/api/plans",
	tags: ["plans"],
}).get("/", async (): Promise<PublicPlansResponse> => {
	const tiers = await db
		.select()
		.from(planTier)
		.orderBy(asc(planTier.sortOrder));

	const features = await db
		.select()
		.from(planFeature)
		.orderBy(asc(planFeature.sortOrder), asc(planFeature.createdAt));

	const joins = await db.select().from(planFeatureTier);

	const tierIdsByFeature = new Map<string, string[]>();
	for (const join of joins) {
		const tierIds = tierIdsByFeature.get(join.featureId) ?? [];
		tierIds.push(join.tierId);
		tierIdsByFeature.set(join.featureId, tierIds);
	}

	return {
		tiers: tiers.map((tier) => ({
			id: tier.id,
			name: tier.name,
			tagline: tier.tagline,
			sortOrder: tier.sortOrder,
			priceMonthlyCents: tier.priceMonthly,
			priceYearlyCents: tier.priceYearly,
			purchasable: PURCHASABLE_TIER_IDS.has(tier.id),
			checkoutSlugs: CHECKOUT_SLUGS_BY_TIER[tier.id] ?? null,
			features: features
				.filter((feature) =>
					(tierIdsByFeature.get(feature.id) ?? []).includes(tier.id),
				)
				.map((feature) => ({
					key: feature.key,
					name: feature.name,
					description: feature.description,
					buildStatus: feature.buildStatus,
					sortOrder: feature.sortOrder,
				})),
		})),
	};
});
