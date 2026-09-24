import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Patron-blocked TV taste-rail suggestions (forever, until Settings UI ships). */
export const tasteDismissedTv = pgTable(
	"taste_dismissed_tv",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tvTmdbId: integer("tv_tmdb_id").notNull(),
		dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("taste_dismissed_tv_user_tv_uk").on(
			table.userId,
			table.tvTmdbId,
		),
		index("taste_dismissed_tv_user_idx").on(table.userId),
	],
);
