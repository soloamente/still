import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Staff-authored Sense Journal articles (public when `status = published`). */
export const journalPost = pgTable(
	"journal_post",
	{
		id: text("id").primaryKey(),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		dek: text("dek"),
		body: text("body").notNull(),
		heroImageUrl: text("hero_image_url"),
		authorUserId: text("author_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		status: text("status").default("draft").notNull(),
		publishedAt: timestamp("published_at"),
		tags: jsonb("tags").$type<string[]>().default([]).notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("journal_post_slug_uk").on(table.slug),
		index("journal_post_status_published_at_idx").on(
			table.status,
			table.publishedAt,
		),
	],
);

export const journalPostRelations = relations(journalPost, ({ one }) => ({
	author: one(user, {
		fields: [journalPost.authorUserId],
		references: [user.id],
	}),
}));
