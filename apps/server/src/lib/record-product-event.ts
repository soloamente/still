import { db, productEvent } from "@still/db";

import { makeId } from "./cuid";
import type { ProductEventKind } from "./product-event-kinds";

export type {
	ClientProductEventKind,
	ProductEventKind,
} from "./product-event-kinds";
export {
	CLIENT_PRODUCT_EVENT_KINDS,
	isClientProductEventKind,
	isProductEventKind,
	PRODUCT_EVENT_KINDS,
} from "./product-event-kinds";

/**
 * Append a product funnel row. Failures are logged and swallowed so core flows
 * (log, import, onboarding) never depend on analytics durability.
 */
export async function recordProductEvent(
	userId: string,
	kind: ProductEventKind,
	properties: Record<string, unknown> = {},
): Promise<void> {
	try {
		await db.insert(productEvent).values({
			id: makeId("pev"),
			userId,
			kind,
			properties,
		});
	} catch (err) {
		console.error("[product-event] record failed", { userId, kind, err });
	}
}
