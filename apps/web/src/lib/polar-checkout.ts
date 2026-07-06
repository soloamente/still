import { authClient } from "@/lib/auth-client";
import { fetchCheckoutDiscountClient } from "@/lib/fetch-checkout-discount-client";

export {
	canManagePolarBilling,
	pricingTierCtaLabel,
} from "@/lib/polar-billing";

/** Open Polar customer portal — upgrades, downgrades, and billing interval changes. */
export async function openPolarCustomerPortal(): Promise<void> {
	await authClient.customer.portal();
}

/** Open Polar checkout — auto-applies referral discount when eligible. */
export async function startPolarCheckout(slug: string): Promise<void> {
	const { discountId } = await fetchCheckoutDiscountClient();
	await authClient.checkout({
		slug,
		...(discountId ? { discountId } : {}),
	});
}
