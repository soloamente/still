import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { movie } from "./movie";
import { tv } from "./tv";

/** Auto-managed list kinds — one row per user per kind (partial unique index). */
export const LIST_SYSTEM_KIND_FAVORITES = "favorites" as const;
export type ListSystemKind = typeof LIST_SYSTEM_KIND_FAVORITES;

/**
 * User-curated film/TV lists. `isRanked` toggles whether `position` matters
 * for display; `coverMovieIds` / `coverTvIds` snapshot poster ids for lobby
 * strips; `movieItemsCount` / `tvItemsCount` power split picker meta lines.
 * `coverMovieId` / `coverTvId` pin one list item poster as the hero tile when set.
 */
export const list = pgTable(
	"list",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		slug: text("slug"),
		description: text("description"),
		isRanked: boolean("is_ranked").default(false).notNull(),
		isPublic: boolean("is_public").default(true).notNull(),
		isCollaborative: boolean("is_collaborative").default(false).notNull(),
		/** `favorites` = synced from `log.liked`; null = patron-created list. */
		systemKind: text("system_kind").$type<ListSystemKind | null>(),
		coverMovieIds: jsonb("cover_movie_ids")
			.$type<number[]>()
			.default([])
			.notNull(),
		/** TMDb tv ids for cover strip — parallel to `coverMovieIds`. */
		coverTvIds: jsonb("cover_tv_ids").$type<number[]>().default([]).notNull(),
		coverMovieId: integer("cover_movie_id"),
		coverTvId: integer("cover_tv_id"),
		coverImageUrl: text("cover_image_url"),
		tags: jsonb("tags").$type<string[]>().default([]).notNull(),
		likesCount: integer("likes_count").default(0).notNull(),
		commentsCount: integer("comments_count").default(0).notNull(),
		itemsCount: integer("items_count").default(0).notNull(),
		movieItemsCount: integer("movie_items_count").default(0).notNull(),
		tvItemsCount: integer("tv_items_count").default(0).notNull(),
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
		uniqueIndex("list_user_favorites_uk")
			.on(table.userId)
			.where(sql`${table.systemKind} = 'favorites'`),
	],
);

/** List membership — movie or TV (XOR), ordered by `position` / `addedAt`. */
export const listItem = pgTable(
	"list_item",
	{
		id: text("id").primaryKey(),
		listId: text("list_id")
			.notNull()
			.references(() => list.id, { onDelete: "cascade" }),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "restrict",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "restrict",
		}),
		position: integer("position").default(0).notNull(),
		note: text("note"),
		addedById: text("added_by_id").references(() => user.id, {
			onDelete: "set null",
		}),
		addedAt: timestamp("added_at").defaultNow().notNull(),
	},
	(table) => [
		check(
			"list_item_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		uniqueIndex("list_item_list_movie_uk")
			.on(table.listId, table.movieId)
			.where(sql`${table.movieId} IS NOT NULL`),
		uniqueIndex("list_item_list_tv_uk")
			.on(table.listId, table.tvId)
			.where(sql`${table.tvId} IS NOT NULL`),
		index("list_item_position_idx").on(table.listId, table.position),
		index("list_item_movie_idx").on(table.movieId),
		index("list_item_tv_idx").on(table.tvId),
	],
);

export const listRelations = relations(list, ({ one, many }) => ({
	user: one(user, { fields: [list.userId], references: [user.id] }),
	items: many(listItem),
}));

export const listItemRelations = relations(listItem, ({ one }) => ({
	list: one(list, { fields: [listItem.listId], references: [list.id] }),
	movie: one(movie, {
		fields: [listItem.movieId],
		references: [movie.tmdbId],
	}),
	tv: one(tv, { fields: [listItem.tvId], references: [tv.tmdbId] }),
	addedBy: one(user, { fields: [listItem.addedById], references: [user.id] }),
}));
