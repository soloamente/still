import { db, profile } from "@still/db";
import { eq } from "drizzle-orm";

import { resolveTierFromPolarProduct } from "./polar-product-map";

export type PolarSubscriptionSyncStatus = "active" | "past_due" | "canceled";

export type SyncProfileFromPolarSubscriptionInput = {
	polarCustomerId: string;
	polarSubscriptionId: string;
	productId: string;
	status: PolarSubscriptionSyncStatus;
	referralDiscountUsed?: boolean;
	/** Better Auth Polar plugin stores `user.id` as Polar customer `externalId`. */
	customerExternalId?: string | null;
};

/**
 * Resolve the patron profile row for a Polar customer.
 * Primary key: `profile.polarCustomerId`. Fallback: `customerExternalId` → `profile.userId`.
 */
async function findProfileForPolarCustomer(
	polarCustomerId: string,
	customerExternalId?: string | null,
): Promise<{ userId: string } | null> {
	const [byPolarCustomer] = await db
		.select({ userId: profile.userId })
		.from(profile)
		.where(eq(profile.polarCustomerId, polarCustomerId))
		.limit(1);

	if (byPolarCustomer) {
		return byPolarCustomer;
	}

	if (customerExternalId) {
		const [byUserId] = await db
			.select({ userId: profile.userId })
			.from(profile)
			.where(eq(profile.userId, customerExternalId))
			.limit(1);

		if (byUserId) {
			return byUserId;
		}
	}

	return null;
}

/**
 * Apply Polar subscription state to `profile` subscription columns only.
 * Never reads or writes `planOverride` — staff overrides stay intact.
 */
export async function syncProfileFromPolarSubscription(
	input: SyncProfileFromPolarSubscriptionInput,
): Promise<void> {
	const patron = await findProfileForPolarCustomer(
		input.polarCustomerId,
		input.customerExternalId,
	);

	if (!patron) {
		console.warn(
			"[polar] sync skipped — no profile for customer",
			input.polarCustomerId,
			input.customerExternalId ?? "",
		);
		return;
	}

	if (input.status === "canceled") {
		await db
			.update(profile)
			.set({
				polarCustomerId: input.polarCustomerId,
				polarSubscriptionId: null,
				subscriptionTier: "still",
				subscriptionInterval: null,
				subscriptionStatus: "canceled",
				...(input.referralDiscountUsed
					? { referralDiscountRedeemed: true }
					: {}),
			})
			.where(eq(profile.userId, patron.userId));
		return;
	}

	const productMapping = resolveTierFromPolarProduct(input.productId);
	if (!productMapping) {
		console.warn("[polar] sync skipped — unknown product id", input.productId);
		return;
	}

	await db
		.update(profile)
		.set({
			polarCustomerId: input.polarCustomerId,
			polarSubscriptionId: input.polarSubscriptionId,
			subscriptionTier: productMapping.tier,
			subscriptionInterval: productMapping.interval,
			subscriptionStatus: input.status,
			...(input.referralDiscountUsed ? { referralDiscountRedeemed: true } : {}),
		})
		.where(eq(profile.userId, patron.userId));
}

/** Clears paid subscription state after cancel/revoke webhook events. */
export async function clearProfileSubscription(
	polarCustomerId: string,
): Promise<void> {
	const patron = await findProfileForPolarCustomer(polarCustomerId);

	if (!patron) {
		console.warn(
			"[polar] clear skipped — no profile for customer",
			polarCustomerId,
		);
		return;
	}

	await db
		.update(profile)
		.set({
			polarCustomerId,
			polarSubscriptionId: null,
			subscriptionTier: "still",
			subscriptionInterval: null,
			subscriptionStatus: "canceled",
		})
		.where(eq(profile.userId, patron.userId));
}
