import { relations } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const staffAuditLog = pgTable(
	"staff_audit_log",
	{
		id: text("id").primaryKey(),
		actorId: text("actor_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		action: text("action").notNull(), // e.g. "user.ban", "content.hide"
		targetType: text("target_type").notNull(), // user | review | list | post | comment | log
		targetId: text("target_id").notNull(),
		reason: text("reason"),
		metadata: jsonb("metadata")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("staff_audit_actor_idx").on(table.actorId),
		index("staff_audit_created_idx").on(table.createdAt),
	],
);

export const staffAuditLogRelations = relations(staffAuditLog, ({ one }) => ({
	actor: one(user, {
		fields: [staffAuditLog.actorId],
		references: [user.id],
	}),
}));

export const staffUserNote = pgTable(
	"staff_user_note",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("staff_user_note_user_idx").on(table.userId),
		index("staff_user_note_created_idx").on(table.createdAt),
	],
);

export const staffUserNoteRelations = relations(staffUserNote, ({ one }) => ({
	user: one(user, {
		fields: [staffUserNote.userId],
		references: [user.id],
		relationName: "staffUserNoteUser",
	}),
	author: one(user, {
		fields: [staffUserNote.authorId],
		references: [user.id],
		relationName: "staffUserNoteAuthor",
	}),
}));
