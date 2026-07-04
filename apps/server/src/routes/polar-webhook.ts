import {
	validateEvent,
	WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { env } from "@still/env/server";
import { Elysia } from "elysia";

import {
	clearProfileSubscription,
	syncProfileFromPolarSubscription,
} from "../lib/sync-profile-subscription";

type PolarSubscriptionPayload = {
	id: string;
	customerId: string;
	productId: string;
	status: string;
	customer?: { externalId?: string | null };
	discountId?: string | null;
};

/** Polar webhook events that carry a subscription payload in `data`. */
const SUBSCRIPTION_EVENT_TYPES = new Set([
	"subscription.active",
	"subscription.updated",
	"subscription.canceled",
	"subscription.revoked",
]);

function subscriptionFromEventData(
	data: unknown,
): PolarSubscriptionPayload | null {
	if (!data || typeof data !== "object") return null;
	const row = data as Record<string, unknown>;
	if (
		typeof row.id !== "string" ||
		typeof row.customerId !== "string" ||
		typeof row.productId !== "string" ||
		typeof row.status !== "string"
	) {
		return null;
	}

	const customer =
		row.customer && typeof row.customer === "object"
			? (row.customer as { externalId?: string | null })
			: undefined;

	return {
		id: row.id,
		customerId: row.customerId,
		productId: row.productId,
		status: row.status,
		customer,
		discountId: typeof row.discountId === "string" ? row.discountId : null,
	};
}

function referralDiscountUsed(subscription: PolarSubscriptionPayload): boolean {
	if (!subscription.discountId || !env.POLAR_DISCOUNT_REFERRAL10) {
		return false;
	}
	return subscription.discountId === env.POLAR_DISCOUNT_REFERRAL10;
}

function mapSubscriptionStatus(
	status: string,
): "active" | "past_due" | "canceled" | null {
	switch (status) {
		case "active":
		case "trialing":
			return "active";
		case "past_due":
			return "past_due";
		case "canceled":
			return "canceled";
		default:
			return null;
	}
}

async function handleSubscriptionEvent(
	eventType: string,
	subscription: PolarSubscriptionPayload,
): Promise<void> {
	if (
		eventType === "subscription.canceled" ||
		eventType === "subscription.revoked"
	) {
		await clearProfileSubscription(subscription.customerId);
		return;
	}

	const mappedStatus = mapSubscriptionStatus(subscription.status);
	if (!mappedStatus || mappedStatus === "canceled") {
		return;
	}

	await syncProfileFromPolarSubscription({
		polarCustomerId: subscription.customerId,
		polarSubscriptionId: subscription.id,
		productId: subscription.productId,
		status: mappedStatus,
		referralDiscountUsed: referralDiscountUsed(subscription),
		customerExternalId: subscription.customer?.externalId ?? null,
	});
}

export const polarWebhookRoute = new Elysia({
	prefix: "/api/polar/webhook",
	tags: ["polar"],
}).post("/", async ({ request, set }) => {
	const secret = env.POLAR_WEBHOOK_SECRET;
	if (!secret) {
		set.status = 503;
		return { error: "Polar webhook secret is not configured" };
	}

	// Signature verification requires the raw request body string.
	const rawBody = await request.text();
	const headers: Record<string, string> = {};
	request.headers.forEach((value, key) => {
		headers[key] = value;
	});

	let event: { type: string; data: unknown };
	try {
		event = validateEvent(rawBody, headers, secret) as {
			type: string;
			data: unknown;
		};
	} catch (error) {
		if (error instanceof WebhookVerificationError) {
			set.status = 403;
			return { error: "Invalid webhook signature" };
		}
		throw error;
	}

	if (SUBSCRIPTION_EVENT_TYPES.has(event.type)) {
		const subscription = subscriptionFromEventData(event.data);
		if (subscription) {
			await handleSubscriptionEvent(event.type, subscription);
		}
	}

	set.status = 202;
	return { ok: true };
});
