import {
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** One live pairing code per patron. Stored as a hash; the popup sees it once. */
export const companionPairCode = pgTable(
	"companion_pair_code",
	{
		codeHash: text("code_hash").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at").notNull(),
		consumedAt: timestamp("consumed_at"),
	},
	(table) => [index("companion_pair_code_user_idx").on(table.userId)],
);

/** Hashed device token for the Sense Companion extension. Revoke sets revoked_at. */
export const companionDevice = pgTable(
	"companion_device",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tokenHash: text("token_hash").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [
		uniqueIndex("companion_device_token_hash_uk").on(table.tokenHash),
		index("companion_device_user_idx").on(table.userId),
	],
);
