import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { movie } from "./movie";

/**
 * User-curated movie lists. `isRanked` toggles whether `position` matters
 * for display; `coverMovieIds` snapshots the four posters used to render
 * the list cover so we don't have to query items just to draw a card.
 */
export const list = pgTable(
  "list",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    slug: text("slug"), // optional pretty URL
    description: text("description"), // markdown
    isRanked: boolean("is_ranked").default(false).notNull(),
    isPublic: boolean("is_public").default(true).notNull(),
    isCollaborative: boolean("is_collaborative").default(false).notNull(),
    coverMovieIds: jsonb("cover_movie_ids").$type<number[]>().default([]).notNull(),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),
    likesCount: integer("likes_count").default(0).notNull(),
    commentsCount: integer("comments_count").default(0).notNull(),
    itemsCount: integer("items_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("list_user_idx").on(table.userId),
    index("list_public_updated_idx").on(table.isPublic, table.updatedAt),
    index("list_likes_idx").on(table.likesCount),
  ],
);

/** Membership: which movies appear in a list, ordered by `position`. */
export const listItem = pgTable(
  "list_item",
  {
    listId: text("list_id")
      .notNull()
      .references(() => list.id, { onDelete: "cascade" }),
    movieId: integer("movie_id")
      .notNull()
      .references(() => movie.tmdbId, { onDelete: "restrict" }),
    position: integer("position").default(0).notNull(),
    note: text("note"),
    addedById: text("added_by_id").references(() => user.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.listId, table.movieId] }),
    index("list_item_position_idx").on(table.listId, table.position),
    index("list_item_movie_idx").on(table.movieId),
  ],
);

export const listRelations = relations(list, ({ one, many }) => ({
  user: one(user, { fields: [list.userId], references: [user.id] }),
  items: many(listItem),
}));

export const listItemRelations = relations(listItem, ({ one }) => ({
  list: one(list, { fields: [listItem.listId], references: [list.id] }),
  movie: one(movie, { fields: [listItem.movieId], references: [movie.tmdbId] }),
  addedBy: one(user, { fields: [listItem.addedById], references: [user.id] }),
}));
