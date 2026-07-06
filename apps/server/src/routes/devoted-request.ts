import { Elysia, t } from "elysia";

import { context } from "../context";
import { submitDevotedRequest } from "../lib/devoted-request";
import { hit } from "../lib/rate-limit";
import { fetchReferralCheckoutDiscountForUser } from "../lib/referral-checkout-discount";
import { syncProfileFromPolarCheckout } from "../lib/sync-polar-checkout";
import { syncProfileFromPolarCustomer } from "../lib/sync-polar-customer";

/**
 * Devoted invite requests + referral checkout discount resolution for Polar.
 * Mounted under `/api/plans` alongside the public catalogue route.
 */
export const devotedRequestRoute = new Elysia({
	prefix: "/api/plans",
	tags: ["plans"],
})
	.use(context)
	.get("/checkout-discount", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");

		const discountId = await fetchReferralCheckoutDiscountForUser(user.id);
		return {
			discountId,
			eligible: discountId != null,
		};
	})
	.post(
		"/sync-checkout",
		async ({ user, status, body }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`plans-sync-checkout:${user.id}`, {
					limit: 10,
					windowMs: 60 * 60 * 1000,
				}).ok
			) {
				return status(429, "Slow down");
			}

			const result = await syncProfileFromPolarCheckout({
				userId: user.id,
				checkoutId: body.checkoutId,
			});

			if (!result.synced) {
				return status(409, result.reason);
			}

			return result;
		},
		{
			body: t.Object({
				checkoutId: t.String({ minLength: 8 }),
			}),
		},
	)
	.post("/sync-subscription", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (
			!hit(`plans-sync-subscription:${user.id}`, {
				limit: 20,
				windowMs: 60 * 60 * 1000,
			}).ok
		) {
			return status(429, "Slow down");
		}

		const result = await syncProfileFromPolarCustomer({ userId: user.id });
		if (!result.synced) {
			return status(409, result.reason);
		}

		return result;
	})
	.post("/devoted-request", async ({ user, status }) => {
		if (!user) return status(401, "Sign in");
		if (
			!hit(`devoted-request:${user.id}`, {
				limit: 3,
				windowMs: 60 * 60 * 1000,
			}).ok
		) {
			return status(429, "Slow down");
		}

		const result = await submitDevotedRequest(user.id);
		if (!result.submitted) {
			if (result.reason === "already_devoted") {
				return status(409, "You already have Devoted access");
			}
			return status(
				409,
				"Request already sent — the Sense team will review soon",
			);
		}

		return { ok: true as const };
	});
