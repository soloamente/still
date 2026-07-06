import { polarClient } from "@still/auth/lib/payments";
import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

import { resolveTierFromPolarProduct } from "./polar-product-map";
import {
	clearProfileSubscription,
	syncProfileFromPolarSubscription,
} from "./sync-profile-subscription";

export type SyncPolarSubscriptionResult =
	| {
			synced: true;
			tier: "still" | "attuned" | "immersed" | "devoted";
			interval: "month" | "year" | null;
	  }
	| {
			synced: false;
			reason:
				| "polar_not_configured"
				| "missing_customer"
				| "missing_product"
				| "no_active_subscription";
	  };

/** Read the patron's active Polar subscription and mirror it on `profile`. */
export async function syncProfileFromPolarCustomer(input: {
	userId: string;
}): Promise<SyncPolarSubscriptionResult> {
	if (!polarClient) {
		return { synced: false, reason: "polar_not_configured" };
	}

	const [profileRow] = await db
		.select({ polarCustomerId: profile.polarCustomerId })
		.from(profile)
		.where(eq(profile.userId, input.userId))
		.limit(1);

	const customerId = profileRow?.polarCustomerId?.trim() ?? "";
	if (!customerId) {
		return { synced: false, reason: "missing_customer" };
	}

	const listed = await polarClient.subscriptions.list({
		customerId,
		limit: 10,
	});
	const activeSubscription = listed.result.items.find(
		(row) => row.status === "active" || row.status === "trialing",
	);

	if (!activeSubscription) {
		await clearProfileSubscription(customerId);
		return { synced: true, tier: "still", interval: null };
	}

	const productId = activeSubscription.productId;
	if (!productId) {
		return { synced: false, reason: "missing_product" };
	}

	const subscriptionStatus =
		activeSubscription.status === "past_due" ? "past_due" : "active";

	await syncProfileFromPolarSubscription({
		polarCustomerId: customerId,
		polarSubscriptionId: activeSubscription.id,
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
