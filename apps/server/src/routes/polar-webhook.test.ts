import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Elysia } from "elysia";

const ATTUNED_MONTHLY_PRODUCT_ID = "prod_attuned_monthly_test";

const syncProfileFromPolarSubscription = mock(async () => {});
const clearProfileSubscription = mock(async () => {});

mock.module("../lib/sync-profile-subscription", () => ({
	syncProfileFromPolarSubscription,
	clearProfileSubscription,
}));

const validateEvent = mock(
	(_body: string, _headers: Record<string, string>) => ({
		type: "subscription.active",
		data: {
			id: "sub_test_1",
			customerId: "cust_test_1",
			productId: ATTUNED_MONTHLY_PRODUCT_ID,
			status: "active",
			customer: { externalId: "user_test_1" },
			discountId: null,
		},
	}),
);

class WebhookVerificationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "WebhookVerificationError";
	}
}

mock.module("@polar-sh/sdk/webhooks", () => ({
	validateEvent,
	WebhookVerificationError,
}));

mock.module("@still/env/server", () => ({
	env: {
		POLAR_WEBHOOK_SECRET: "whsec_test_secret",
		POLAR_DISCOUNT_REFERRAL10: undefined,
	},
}));

const { polarWebhookRoute } = await import("./polar-webhook");
const { WebhookVerificationError: PolarWebhookVerificationError } =
	await import("@polar-sh/sdk/webhooks");

function call(body: string, signatureValid = true) {
	if (!signatureValid) {
		validateEvent.mockImplementationOnce(() => {
			throw new PolarWebhookVerificationError("Invalid signature");
		});
	}

	return new Elysia().use(polarWebhookRoute).handle(
		new Request("http://localhost/api/polar/webhook", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"webhook-id": "msg_test",
				"webhook-timestamp": String(Math.floor(Date.now() / 1000)),
				"webhook-signature": "v1,test",
			},
			body,
		}),
	);
}

describe("polarWebhookRoute", () => {
	beforeEach(() => {
		syncProfileFromPolarSubscription.mockClear();
		clearProfileSubscription.mockClear();
		validateEvent.mockClear();
		validateEvent.mockImplementation((_body, _headers) => ({
			type: "subscription.active",
			data: {
				id: "sub_test_1",
				customerId: "cust_test_1",
				productId: ATTUNED_MONTHLY_PRODUCT_ID,
				status: "active",
				customer: { externalId: "user_test_1" },
				discountId: null,
			},
		}));
	});

	test("subscription.active syncs attuned tier", async () => {
		const payload = JSON.stringify({
			type: "subscription.active",
			timestamp: "2026-07-05T00:00:00.000Z",
			data: {
				id: "sub_test_1",
				customer_id: "cust_test_1",
				product_id: ATTUNED_MONTHLY_PRODUCT_ID,
				status: "active",
			},
		});

		const res = await call(payload);
		expect(res.status).toBe(202);
		expect(await res.json()).toEqual({ ok: true });
		expect(syncProfileFromPolarSubscription).toHaveBeenCalledWith({
			polarCustomerId: "cust_test_1",
			polarSubscriptionId: "sub_test_1",
			productId: ATTUNED_MONTHLY_PRODUCT_ID,
			status: "active",
			referralDiscountUsed: false,
			customerExternalId: "user_test_1",
		});
		expect(clearProfileSubscription).not.toHaveBeenCalled();
	});

	test("invalid signature returns 403", async () => {
		const res = await call("{}", false);
		expect(res.status).toBe(403);
		expect(await res.json()).toEqual({ error: "Invalid webhook signature" });
		expect(syncProfileFromPolarSubscription).not.toHaveBeenCalled();
		expect(clearProfileSubscription).not.toHaveBeenCalled();
	});

	test("subscription.canceled clears profile subscription", async () => {
		validateEvent.mockImplementationOnce(() => ({
			type: "subscription.canceled",
			data: {
				id: "sub_test_1",
				customerId: "cust_test_1",
				productId: ATTUNED_MONTHLY_PRODUCT_ID,
				status: "canceled",
				customer: { externalId: "user_test_1" },
			},
		}));

		const res = await call("{}");
		expect(res.status).toBe(202);
		expect(clearProfileSubscription).toHaveBeenCalledWith("cust_test_1");
		expect(syncProfileFromPolarSubscription).not.toHaveBeenCalled();
	});
});
