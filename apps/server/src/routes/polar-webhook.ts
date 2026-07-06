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

const CUSTOMER_STATE_CHANGED = "customer.state_changed";

function readStringField(
	row: Record<string, unknown>,
	...keys: string[]
): string | null {
	for (const key of keys) {
		const value = row[key];
		if (typeof value === "string" && value.length > 0) {
			return value;
		}
	}
	return null;
}

function subscriptionFromEventData(
	data: unknown,
): PolarSubscriptionPayload | null {
	if (!data || typeof data !== "object") return null;
	const row = data as Record<string, unknown>;

	const id = readStringField(row, "id");
	const customerId = readStringField(row, "customerId", "customer_id");
	const productId = readStringField(row, "productId", "product_id");
	const status = readStringField(row, "status");

	if (!id || !customerId || !productId || !status) {
		return null;
	}

	const customerRaw = row.customer;
	const customer =
		customerRaw && typeof customerRaw === "object"
			? (customerRaw as {
					externalId?: string | null;
					external_id?: string | null;
				})
			: undefined;

	const discountId = readStringField(row, "discountId", "discount_id");

	return {
		id,
		customerId,
		productId,
		status,
		customer: customer
			? {
					externalId: customer.externalId ?? customer.external_id ?? null,
				}
			: undefined,
		discountId,
	};
}

/** Sandbox often emits `customer.state_changed` with nested `active_subscriptions`. */
function subscriptionFromCustomerState(
	data: unknown,
): PolarSubscriptionPayload | null {
	if (!data || typeof data !== "object") return null;
	const row = data as Record<string, unknown>;
	const customerId = readStringField(row, "id");
	if (!customerId) return null;

	const externalId = readStringField(row, "externalId", "external_id");
	const activeSubscriptions = row.active_subscriptions;
	if (!Array.isArray(activeSubscriptions) || activeSubscriptions.length === 0) {
		return {
			id: "",
			customerId,
			productId: "",
			status: "canceled",
			customer: externalId ? { externalId } : undefined,
		};
	}

	const activeRow = activeSubscriptions.find((entry) => {
		if (!entry || typeof entry !== "object") return false;
		const status = readStringField(entry as Record<string, unknown>, "status");
		return status === "active" || status === "trialing";
	});

	if (!activeRow || typeof activeRow !== "object") {
		return {
			id: "",
			customerId,
			productId: "",
			status: "canceled",
			customer: externalId ? { externalId } : undefined,
		};
	}

	const subscription = activeRow as Record<string, unknown>;
	const id = readStringField(subscription, "id");
	const productId = readStringField(subscription, "productId", "product_id");
	const status = readStringField(subscription, "status");
	if (!id || !productId || !status) return null;

	return {
		id,
		customerId,
		productId,
		status,
		customer: externalId ? { externalId } : undefined,
		discountId: readStringField(subscription, "discountId", "discount_id"),
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
		eventType === "subscription.revoked" ||
		(subscription.status === "canceled" && !subscription.productId)
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

async function handlePolarWebhookEvent(
	eventType: string,
	data: unknown,
): Promise<void> {
	if (eventType === CUSTOMER_STATE_CHANGED) {
		const subscription = subscriptionFromCustomerState(data);
		if (subscription) {
			await handleSubscriptionEvent(eventType, subscription);
		}
		return;
	}

	if (SUBSCRIPTION_EVENT_TYPES.has(eventType)) {
		const subscription = subscriptionFromEventData(data);
		if (subscription) {
			await handleSubscriptionEvent(eventType, subscription);
		}
	}
}

export const polarWebhookRoute = new Elysia({
	prefix: "/api/polar/webhook",
	tags: ["polar"],
}).post(
	"/",
	async ({ request, set }) => {
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

		await handlePolarWebhookEvent(event.type, event.data);

		set.status = 202;
		return { ok: true };
	},
	{
		// Elysia auto-parse consumes the body stream; Polar needs the raw payload.
		parse: "none",
	},
);
