import { env } from "@still/env/server";

export type PolarCheckoutProduct = {
	productId: string;
	slug: string;
};

let partialProductsWarned = false;

/**
 * Checkout slugs match the public pricing page tier cards:
 * Attuned / Immersed × monthly / yearly.
 */
export function buildPolarCheckoutProducts(): PolarCheckoutProduct[] {
	const attunedMonthly = env.POLAR_PRODUCT_ATTUNED_MONTHLY;
	const attunedYearly = env.POLAR_PRODUCT_ATTUNED_YEARLY;
	const immersedMonthly = env.POLAR_PRODUCT_IMMERSED_MONTHLY;
	const immersedYearly = env.POLAR_PRODUCT_IMMERSED_YEARLY;

	const productIds = [
		attunedMonthly,
		attunedYearly,
		immersedMonthly,
		immersedYearly,
	];
	const configuredCount = productIds.filter(Boolean).length;

	if (attunedMonthly && attunedYearly && immersedMonthly && immersedYearly) {
		return [
			{ productId: attunedMonthly, slug: "attuned-monthly" },
			{ productId: attunedYearly, slug: "attuned-yearly" },
			{ productId: immersedMonthly, slug: "immersed-monthly" },
			{ productId: immersedYearly, slug: "immersed-yearly" },
		];
	}

	// Partial config is easy to misconfigure during sandbox setup — warn once in dev.
	if (
		configuredCount > 0 &&
		env.NODE_ENV === "development" &&
		!partialProductsWarned
	) {
		partialProductsWarned = true;
		console.warn(
			"[polar] Some POLAR_PRODUCT_* env vars are set but not all four — checkout products disabled.",
		);
	}

	return [];
}
