import { env } from "@still/env/web";

import type { ClientProductEventKind } from "@/lib/product-event-kinds";

/** Client-allowed kinds — must match `CLIENT_PRODUCT_EVENT_KINDS` on the server. */
export type SenseClientProductEventKind = ClientProductEventKind;

/**
 * Fire-and-forget product funnel event. No-ops when unauthenticated or offline.
 */
export function trackSenseProductEvent(
	kind: SenseClientProductEventKind,
	properties: Record<string, unknown> = {},
): void {
	const base = env.NEXT_PUBLIC_SERVER_URL?.replace(/\/$/, "");
	if (!base) return;

	void fetch(`${base}/api/product-events`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ kind, properties }),
	}).catch((err) => {
		console.warn("[sense-analytics] event failed", kind, err);
	});
}
