import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	smallint,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { movie } from "./movie";
import { tv } from "./tv";
import { contentVisibility } from "./visibility";

/** Where the patron watched the film — aligns with `/home` + `/diary` venue chips (`?venue=`). */
export type LogWatchVenue = "theaters" | "streaming";

/** TV diary granularity — whole series, one season, or a single episode. */
export type TvLogScope = "show" | "season" | "episode";

/**
 * A "watch" record — Letterboxd's diary entry. Exactly one of `movieId` or `tvId`
 * is set (enforced by DB check + partial indexes on watchlist).
 *
 * `rating` stores half-stars as 1..10 (so a 4.5★ = 9). NULL = unrated.
 * `liked` is the heart icon; independent of the score.
 */
export const log = pgTable(
	"log",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "restrict",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "restrict",
		}),
		watchedAt: timestamp("watched_at").notNull(),
		rating: smallint("rating"), // 1..10 representing half-stars
		liked: boolean("liked").default(false).notNull(),
		rewatch: boolean("rewatch").default(false).notNull(),
		// Optional short note attached to the diary entry itself (separate from a full review).
		note: text("note"),
		containsSpoilers: boolean("contains_spoilers").default(false).notNull(),
		visibility: contentVisibility("visibility").default("public").notNull(),
		/** In-cinema vs at-home — drives `/diary?venue=` filtering; default **streaming**. */
		watchVenue: text("watch_venue")
			.$type<LogWatchVenue>()
			.notNull()
			.default("streaming"),
		/** TV-only — `show` is default for legacy rows and whole-series logs. */
		logScope: text("log_scope").$type<TvLogScope>().notNull().default("show"),
		seasonNumber: smallint("season_number"),
		episodeNumber: smallint("episode_number"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		removedAt: timestamp("removed_at"),
		removedBy: text("removed_by"),
		removalReason: text("removal_reason"),
	},
	(table) => [
		check(
			"log_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		index("log_user_watched_idx").on(table.userId, table.watchedAt),
		index("log_movie_idx").on(table.movieId),
		index("log_tv_idx").on(table.tvId),
		index("log_user_movie_idx").on(table.userId, table.movieId),
		index("log_user_tv_idx").on(table.userId, table.tvId),
		// Sanity: half-star ratings must fall in 1..10 if present.
		index("log_rating_idx").on(table.rating),
		index("log_user_venue_idx").on(table.userId, table.watchVenue),
	],
);

/**
 * Long-form review. May be attached to a specific `log` (preferred — links
 * to the rating + watch date) or stand alone.
 */
export const review = pgTable(
	"review",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieId: integer("movie_id")
			.notNull()
			.references(() => movie.tmdbId, { onDelete: "restrict" }),
		logId: text("log_id").references(() => log.id, { onDelete: "set null" }),
		title: text("title"),
		body: text("body").notNull(), // markdown
		containsSpoilers: boolean("contains_spoilers").default(false).notNull(),
		visibility: contentVisibility("visibility").default("public").notNull(),
		// Denormalized counters to avoid count(*) on every render. Updated by triggers.
		likesCount: integer("likes_count").default(0).notNull(),
		dislikesCount: integer("dislikes_count").default(0).notNull(),
		commentsCount: integer("comments_count").default(0).notNull(),
		rating: smallint("rating"), // mirrors log.rating if linked; saved here for unlinked reviews
		/** TMDb backdrop slide key from `buildScreenshotSlides` — review reader hero. */
		stillSlideKey: text("still_slide_key"),
		/** Optional voice note — public Blob URL when patron attaches audio to a review. */
		audioUrl: text("audio_url"),
		audioDurationMs: integer("audio_duration_ms"),
		audioMimeType: text("audio_mime_type"),
		publishedAt: timestamp("published_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
		removedAt: timestamp("removed_at"),
		removedBy: text("removed_by"),
		removalReason: text("removal_reason"),
	},
	(table) => [
		index("review_user_idx").on(table.userId),
		index("review_movie_idx").on(table.movieId),
		index("review_published_idx").on(table.publishedAt),
		index("review_likes_idx").on(table.likesCount),
	],
);

/**
 * One film **or** one TV series per row; partial unique indexes keep `(user, movie)`
 * and `(user, tv)` disjoint. `priority` is 0–100 so users can sort without positions.
 */
export const watchlistItem = pgTable(
	"watchlist_item",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "restrict",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "restrict",
		}),
		addedAt: timestamp("added_at").defaultNow().notNull(),
		// Optional reminder window — let users surface things they'd promised to watch.
		remindAt: timestamp("remind_at"),
		priority: smallint("priority").default(50).notNull(),
		note: text("note"),
	},
	(table) => [
		check(
			"watchlist_item_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		uniqueIndex("watchlist_user_movie_uk")
			.on(table.userId, table.movieId)
			.where(sql`${table.movieId} IS NOT NULL`),
		uniqueIndex("watchlist_user_tv_uk")
			.on(table.userId, table.tvId)
			.where(sql`${table.tvId} IS NOT NULL`),
		index("watchlist_user_added_idx").on(table.userId, table.addedAt),
	],
);

export const logRelations = relations(log, ({ one, many }) => ({
	user: one(user, { fields: [log.userId], references: [user.id] }),
	movie: one(movie, { fields: [log.movieId], references: [movie.tmdbId] }),
	tv: one(tv, { fields: [log.tvId], references: [tv.tmdbId] }),
	reviews: many(review),
}));

export const reviewRelations = relations(review, ({ one }) => ({
	user: one(user, { fields: [review.userId], references: [user.id] }),
	movie: one(movie, { fields: [review.movieId], references: [movie.tmdbId] }),
	log: one(log, { fields: [review.logId], references: [log.id] }),
}));

export const watchlistItemRelations = relations(watchlistItem, ({ one }) => ({
	user: one(user, { fields: [watchlistItem.userId], references: [user.id] }),
	movie: one(movie, {
		fields: [watchlistItem.movieId],
		references: [movie.tmdbId],
	}),
	tv: one(tv, { fields: [watchlistItem.tvId], references: [tv.tmdbId] }),
}));
