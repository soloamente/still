import { relations } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** What a comment/reaction is attached to. Generic so we don't add a column per parent type. */
export const reactionParentType = pgEnum("reaction_parent_type", [
	"review",
	"post",
	"list",
	"comment",
	"log",
]);

export const reactionKind = pgEnum("reaction_kind", [
	"like",
	"dislike",
	"love",
	"spotlight", // boost — surfaces it on the feed
	"fire",
	"mind_blown",
	"laugh",
]);

export const postKind = pgEnum("post_kind", [
	"status", // bare text status
	"share", // shared a review/list/movie
	"milestone", // automated: 100 films logged, badge unlocked, etc.
]);

/**
 * Lightweight user-authored social posts (Twitter-style). Distinct from
 * `review` so the model stays single-purpose. Use `refType` + `refId` to
 * attach the post to a movie, review, or list.
 */
export const post = pgTable(
	"post",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		kind: postKind("kind").default("status").notNull(),
		body: text("body").notNull(),
		refType: text("ref_type"), // optional: movie | review | list | badge
		refId: text("ref_id"), // string for flexibility (movieId is just text-coerced)
		attachments: jsonb("attachments")
			.$type<
				{
					url: string;
					kind: "image" | "gif";
					width?: number;
					height?: number;
				}[]
			>()
			.default([])
			.notNull(),
		likesCount: integer("likes_count").default(0).notNull(),
		commentsCount: integer("comments_count").default(0).notNull(),
		publishedAt: timestamp("published_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("post_user_idx").on(table.userId),
		index("post_published_idx").on(table.publishedAt),
		index("post_ref_idx").on(table.refType, table.refId),
	],
);

/**
 * Generic comment table. `parentType` + `parentId` covers comments on
 * reviews, lists, posts, and threaded comment replies (via `replyToId`).
 */
export const comment = pgTable(
	"comment",
	{
		id: text("id").primaryKey(),
		parentType: reactionParentType("parent_type").notNull(),
		parentId: text("parent_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		replyToId: text("reply_to_id"),
		likesCount: integer("likes_count").default(0).notNull(),
		dislikesCount: integer("dislikes_count").default(0).notNull(),
		editedAt: timestamp("edited_at"),
		deletedAt: timestamp("deleted_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("comment_parent_idx").on(
			table.parentType,
			table.parentId,
			table.createdAt,
		),
		index("comment_user_idx").on(table.userId),
		index("comment_reply_to_idx").on(table.replyToId),
	],
);

/** Reactions are a single composite-PK row per (user, target, kind). */
export const reaction = pgTable(
	"reaction",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		parentType: reactionParentType("parent_type").notNull(),
		parentId: text("parent_id").notNull(),
		kind: reactionKind("kind").default("like").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({
			columns: [table.userId, table.parentType, table.parentId, table.kind],
		}),
		index("reaction_target_idx").on(table.parentType, table.parentId),
	],
);

export const postRelations = relations(post, ({ one }) => ({
	user: one(user, { fields: [post.userId], references: [user.id] }),
}));

export const commentRelations = relations(comment, ({ one }) => ({
	user: one(user, { fields: [comment.userId], references: [user.id] }),
}));

export const reactionRelations = relations(reaction, ({ one }) => ({
	user: one(user, { fields: [reaction.userId], references: [user.id] }),
}));
