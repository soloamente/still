import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * First-party product funnel events (Sense Phase 0 metrics).
 * Separate from `event_log`, which powers badge evaluation.
 */
export const productEvent = pgTable(
	"product_event",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		properties: jsonb("properties")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("product_event_user_kind_idx").on(table.userId, table.kind),
		index("product_event_kind_created_idx").on(table.kind, table.createdAt),
	],
);
