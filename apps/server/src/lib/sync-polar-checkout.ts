import { polarClient } from "@still/auth/lib/payments";

import { resolveTierFromPolarProduct } from "./polar-product-map";
import { syncProfileFromPolarSubscription } from "./sync-profile-subscription";

export type SyncPolarCheckoutResult =
	| {
			synced: true;
			tier: "attuned" | "immersed" | "devoted";
			interval: "month" | "year";
	  }
	| {
			synced: false;
			reason:
				| "polar_not_configured"
				| "checkout_not_found"
				| "checkout_not_complete"
				| "checkout_mismatch"
				| "missing_customer"
				| "missing_product"
				| "no_active_subscription";
	  };

/** Checkout statuses that mean payment completed in Polar sandbox. */
function checkoutIsComplete(status: string): boolean {
	return status === "succeeded" || status === "confirmed" || status === "paid";
}

/**
 * Pull subscription state from Polar after checkout — local dev fallback when
 * webhooks cannot reach localhost. Production should still rely on webhooks.
 */
export async function syncProfileFromPolarCheckout(input: {
	userId: string;
	checkoutId: string;
}): Promise<SyncPolarCheckoutResult> {
	if (!polarClient) {
		return { synced: false, reason: "polar_not_configured" };
	}

	let checkout: Awaited<ReturnType<typeof polarClient.checkouts.get>>;
	try {
		checkout = await polarClient.checkouts.get({ id: input.checkoutId });
	} catch {
		return { synced: false, reason: "checkout_not_found" };
	}

	if (!checkoutIsComplete(checkout.status)) {
		return { synced: false, reason: "checkout_not_complete" };
	}

	const customerId = checkout.customerId;
	if (!customerId) {
		return { synced: false, reason: "missing_customer" };
	}

	// Checkout payload only includes customerId — fetch the full customer record.
	const customer = await polarClient.customers
		.get({ id: customerId })
		.catch(() => null);

	if (!customer || customer.externalId !== input.userId) {
		return { synced: false, reason: "checkout_mismatch" };
	}

	let subscriptionId = checkout.subscriptionId ?? null;
	let productId = checkout.productId ?? null;
	let subscriptionStatus: "active" | "past_due" = "active";

	if (!subscriptionId || !productId) {
		const listed = await polarClient.subscriptions.list({
			customerId,
			limit: 10,
		});
		const activeSubscription = listed.result.items.find(
			(row) => row.status === "active" || row.status === "trialing",
		);

		if (!activeSubscription) {
			return { synced: false, reason: "no_active_subscription" };
		}

		subscriptionId = activeSubscription.id;
		productId = activeSubscription.productId;
		subscriptionStatus =
			activeSubscription.status === "past_due" ? "past_due" : "active";
	}

	if (!productId || !subscriptionId) {
		return { synced: false, reason: "missing_product" };
	}

	await syncProfileFromPolarSubscription({
		polarCustomerId: customerId,
		polarSubscriptionId: subscriptionId,
		productId,
		status: subscriptionStatus,
		customerExternalId: input.userId,
	});

	const mapping = resolveTierFromPolarProduct(productId);
	if (!mapping) {
		return { synced: false, reason: "missing_product" };
	}

	return {
		synced: true,
		tier: mapping.tier,
		interval: mapping.interval,
	};
}
