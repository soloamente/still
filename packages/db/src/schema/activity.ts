import { relations } from "drizzle-orm";
import {
  boolean,
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

/**
 * A "watch" record — Letterboxd's diary entry. One per (user, movie, watchedAt).
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
    movieId: integer("movie_id")
      .notNull()
      .references(() => movie.tmdbId, { onDelete: "restrict" }),
    watchedAt: timestamp("watched_at").notNull(),
    rating: smallint("rating"), // 1..10 representing half-stars
    liked: boolean("liked").default(false).notNull(),
    rewatch: boolean("rewatch").default(false).notNull(),
    // Optional short note attached to the diary entry itself (separate from a full review).
    note: text("note"),
    containsSpoilers: boolean("contains_spoilers").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("log_user_watched_idx").on(table.userId, table.watchedAt),
    index("log_movie_idx").on(table.movieId),
    index("log_user_movie_idx").on(table.userId, table.movieId),
    // Sanity: half-star ratings must fall in 1..10 if present.
    index("log_rating_idx").on(table.rating),
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
    isPublic: boolean("is_public").default(true).notNull(),
    // Denormalized counters to avoid count(*) on every render. Updated by triggers.
    likesCount: integer("likes_count").default(0).notNull(),
    commentsCount: integer("comments_count").default(0).notNull(),
    rating: smallint("rating"), // mirrors log.rating if linked; saved here for unlinked reviews
    publishedAt: timestamp("published_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("review_user_idx").on(table.userId),
    index("review_movie_idx").on(table.movieId),
    index("review_published_idx").on(table.publishedAt),
    index("review_likes_idx").on(table.likesCount),
  ],
);

/**
 * One movie can appear once on a user's watchlist. `priority` is 0–100
 * so users can sort their own list without storing positions.
 */
export const watchlistItem = pgTable(
  "watchlist_item",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movie.tmdbId, { onDelete: "restrict" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    // Optional reminder window — let users surface things they'd promised to watch.
    remindAt: timestamp("remind_at"),
    priority: smallint("priority").default(50).notNull(),
    note: text("note"),
  },
  (table) => [
    uniqueIndex("watchlist_user_movie_uk").on(table.userId, table.movieId),
    index("watchlist_user_added_idx").on(table.userId, table.addedAt),
  ],
);

export const logRelations = relations(log, ({ one, many }) => ({
  user: one(user, { fields: [log.userId], references: [user.id] }),
  movie: one(movie, { fields: [log.movieId], references: [movie.tmdbId] }),
  reviews: many(review),
}));

export const reviewRelations = relations(review, ({ one }) => ({
  user: one(user, { fields: [review.userId], references: [user.id] }),
  movie: one(movie, { fields: [review.movieId], references: [movie.tmdbId] }),
  log: one(log, { fields: [review.logId], references: [log.id] }),
}));

export const watchlistItemRelations = relations(watchlistItem, ({ one }) => ({
  user: one(user, { fields: [watchlistItem.userId], references: [user.id] }),
  movie: one(movie, { fields: [watchlistItem.movieId], references: [movie.tmdbId] }),
}));
