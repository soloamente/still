import { env } from "@still/env/server";

export type PolarProductTier = "attuned" | "immersed" | "devoted";
export type PolarProductInterval = "month" | "year";

export type PolarProductMapping = {
	tier: PolarProductTier;
	interval: PolarProductInterval;
};

/**
 * Maps Polar checkout product UUIDs (from env) to Sense subscription tier + cadence.
 * Env keys mirror `packages/auth/src/lib/polar-checkout-products.ts`.
 */
export function resolveTierFromPolarProduct(
	productId: string,
): PolarProductMapping | null {
	const mappings: Array<[string | undefined, PolarProductMapping]> = [
		[env.POLAR_PRODUCT_ATTUNED_MONTHLY, { tier: "attuned", interval: "month" }],
		[env.POLAR_PRODUCT_ATTUNED_YEARLY, { tier: "attuned", interval: "year" }],
		[
			env.POLAR_PRODUCT_IMMERSED_MONTHLY,
			{ tier: "immersed", interval: "month" },
		],
		[env.POLAR_PRODUCT_IMMERSED_YEARLY, { tier: "immersed", interval: "year" }],
		[env.POLAR_PRODUCT_DEVOTED_MONTHLY, { tier: "devoted", interval: "month" }],
		[env.POLAR_PRODUCT_DEVOTED_YEARLY, { tier: "devoted", interval: "year" }],
	];

	for (const [configuredId, mapping] of mappings) {
		if (configuredId && configuredId === productId) {
			return mapping;
		}
	}

	return null;
}
