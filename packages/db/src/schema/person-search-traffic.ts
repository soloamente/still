import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * On-site search traffic per TMDb person — powers cast/crew rank in catalog search.
 * Incremented when a patron opens someone from the search dialog.
 */
export const personSearchTraffic = pgTable(
	"person_search_traffic",
	{
		tmdbId: integer("tmdb_id").primaryKey(),
		hitCount: integer("hit_count").default(0).notNull(),
		name: text("name").default("").notNull(),
		profileUrl: text("profile_url"),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("person_search_traffic_hits_idx").on(table.hitCount)],
);
