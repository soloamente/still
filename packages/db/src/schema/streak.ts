import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Materialized diary streak (Sense Tier 1).
 * Qualifying activity = at least one log per UTC calendar day (`log.watched_at`).
 * Shields cover a missed day; one auto-grace bridges a single-day gap once.
 */
export const userStreak = pgTable("user_streak", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	currentStreak: integer("current_streak").default(0).notNull(),
	longestStreak: integer("longest_streak").default(0).notNull(),
	/** Last UTC day key (YYYY-MM-DD) with qualifying activity. */
	lastActiveDay: date("last_active_day"),
	/** Manual freeze tokens — cover one missed day each. */
	shieldsRemaining: integer("shields_remaining").default(2).notNull(),
	/** One-time automatic bridge for a single skipped day (recovery, not a cliff). */
	autoGraceAvailable: boolean("auto_grace_available").default(true).notNull(),
	/** UTC day covered by a manual shield (no log required that day). */
	freezeCoversDay: date("freeze_covers_day"),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

export const userStreakRelations = relations(userStreak, ({ one }) => ({
	user: one(user, { fields: [userStreak.userId], references: [user.id] }),
}));
