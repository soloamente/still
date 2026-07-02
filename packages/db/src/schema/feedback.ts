import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Patron-submitted feedback category (Bug · Idea · Other). */
export const patronFeedbackCategory = pgEnum("patron_feedback_category", [
	"bug",
	"idea",
	"other",
]);

export type PatronFeedbackCategory =
	(typeof patronFeedbackCategory.enumValues)[number];

/** Staff triage lifecycle for a feedback ticket. */
export const patronFeedbackStatus = pgEnum("patron_feedback_status", [
	"open",
	"resolved",
	"dismissed",
]);

export type PatronFeedbackStatus =
	(typeof patronFeedbackStatus.enumValues)[number];

/** Patron feedback ticket — one initial message per row. */
export const patronFeedback = pgTable(
	"patron_feedback",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		category: patronFeedbackCategory("category").notNull(),
		body: text("body").notNull(),
		pageUrl: text("page_url"),
		status: patronFeedbackStatus("status").default("open").notNull(),
		lastStaffReplyAt: timestamp("last_staff_reply_at", { withTimezone: true }),
		patronLastReadAt: timestamp("patron_last_read_at", { withTimezone: true }),
		resolvedAt: timestamp("resolved_at", { withTimezone: true }),
		resolvedByUserId: text("resolved_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("patron_feedback_user_created_idx").on(table.userId, table.createdAt),
		index("patron_feedback_status_created_idx").on(
			table.status,
			table.createdAt,
		),
	],
);

/** Staff reply visible to the submitting patron. */
export const patronFeedbackReply = pgTable(
	"patron_feedback_reply",
	{
		id: text("id").primaryKey(),
		feedbackId: text("feedback_id")
			.notNull()
			.references(() => patronFeedback.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("patron_feedback_reply_feedback_idx").on(
			table.feedbackId,
			table.createdAt,
		),
	],
);

/** Internal staff note — never exposed on patron API routes. */
export const patronFeedbackStaffNote = pgTable(
	"patron_feedback_staff_note",
	{
		id: text("id").primaryKey(),
		feedbackId: text("feedback_id")
			.notNull()
			.references(() => patronFeedback.id, { onDelete: "cascade" }),
		authorId: text("author_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("patron_feedback_staff_note_feedback_idx").on(
			table.feedbackId,
			table.createdAt,
		),
	],
);

export const patronFeedbackRelations = relations(
	patronFeedback,
	({ one, many }) => ({
		user: one(user, {
			fields: [patronFeedback.userId],
			references: [user.id],
		}),
		replies: many(patronFeedbackReply),
		staffNotes: many(patronFeedbackStaffNote),
	}),
);

export const patronFeedbackReplyRelations = relations(
	patronFeedbackReply,
	({ one }) => ({
		feedback: one(patronFeedback, {
			fields: [patronFeedbackReply.feedbackId],
			references: [patronFeedback.id],
		}),
		author: one(user, {
			fields: [patronFeedbackReply.authorId],
			references: [user.id],
		}),
	}),
);

export const patronFeedbackStaffNoteRelations = relations(
	patronFeedbackStaffNote,
	({ one }) => ({
		feedback: one(patronFeedback, {
			fields: [patronFeedbackStaffNote.feedbackId],
			references: [patronFeedback.id],
		}),
		author: one(user, {
			fields: [patronFeedbackStaffNote.authorId],
			references: [user.id],
		}),
	}),
);
