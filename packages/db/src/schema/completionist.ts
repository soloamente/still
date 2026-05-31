import { relations } from "drizzle-orm";
import {
	index,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Patron enrollment in a curated completionist challenge (Sense Tier 1).
 * Progress is derived from diary logs vs the static catalog on the server.
 */
export const userCompletionistChallenge = pgTable(
	"user_completionist_challenge",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		challengeId: text("challenge_id").notNull(),
		enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
		completedAt: timestamp("completed_at"),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.challengeId] }),
		index("user_completionist_challenge_user_idx").on(table.userId),
		index("user_completionist_challenge_open_idx").on(
			table.userId,
			table.completedAt,
		),
	],
);

export const userCompletionistChallengeRelations = relations(
	userCompletionistChallenge,
	({ one }) => ({
		user: one(user, {
			fields: [userCompletionistChallenge.userId],
			references: [user.id],
		}),
	}),
);
