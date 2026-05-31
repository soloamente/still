import { Elysia, t } from "elysia";

import { context } from "../context";
import { hit } from "../lib/rate-limit";
import {
	isClientProductEventKind,
	recordProductEvent,
} from "../lib/record-product-event";

/**
 * Client-recorded funnel events (share taste card, onboarding complete).
 * Server-side funnels (import, first log) write directly in domain routes.
 */
export const productEventsRoute = new Elysia({
	prefix: "/api/product-events",
	tags: ["product-events"],
})
	.use(context)
	.post(
		"/",
		async ({ body, user, status }) => {
			if (!user) return status(401, "Sign in");
			if (
				!hit(`product-events:${user.id}`, { limit: 60, windowMs: 60_000 }).ok
			) {
				return status(429, "Slow down");
			}
			if (!isClientProductEventKind(body.kind)) {
				return status(400, "Unknown event kind");
			}
			const properties =
				body.properties && typeof body.properties === "object"
					? (body.properties as Record<string, unknown>)
					: {};
			await recordProductEvent(user.id, body.kind, properties);
			return { ok: true };
		},
		{
			body: t.Object({
				kind: t.String(),
				properties: t.Optional(t.Record(t.String(), t.Unknown())),
			}),
		},
	);
