import { relations } from "drizzle-orm";
import {
	boolean,
	doublePrecision,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/**
 * Local mirror of TMDb `/tv/:id` — same role as `movie` for FK targets on
 * diary rows and watchlist items. Full payload lives in `tmdbJson`.
 */
export const tv = pgTable(
	"tv",
	{
		tmdbId: integer("tmdb_id").primaryKey(),
		title: text("title").notNull(),
		originalTitle: text("original_title"),
		year: integer("year"),
		firstAirDate: timestamp("first_air_date", { withTimezone: false }),
		overview: text("overview"),
		posterPath: text("poster_path"),
		backdropPath: text("backdrop_path"),
		genreIds: jsonb("genre_ids").$type<number[]>().default([]).notNull(),
		originalLanguage: text("original_language"),
		popularity: doublePrecision("popularity"),
		voteAverage: doublePrecision("vote_average"),
		voteCount: integer("vote_count"),
		adult: boolean("adult").default(false).notNull(),
		status: text("status"),
		tmdbJson: jsonb("tmdb_json").$type<Record<string, unknown>>(),
		lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("tv_title_idx").on(table.title),
		index("tv_year_idx").on(table.year),
	],
);

export const tvRelations = relations(tv, () => ({}));
