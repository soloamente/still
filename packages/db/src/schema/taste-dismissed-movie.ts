import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Patron-blocked taste-rail suggestions (forever, until Settings UI ships). */
export const tasteDismissedMovie = pgTable(
	"taste_dismissed_movie",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieTmdbId: integer("movie_tmdb_id").notNull(),
		dismissedAt: timestamp("dismissed_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("taste_dismissed_movie_user_movie_uk").on(
			table.userId,
			table.movieTmdbId,
		),
		index("taste_dismissed_movie_user_idx").on(table.userId),
	],
);
