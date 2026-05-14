import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const chatThreadKind = pgEnum("chat_thread_kind", ["dm", "group"]);
export const chatMemberRole = pgEnum("chat_member_role", ["owner", "admin", "member"]);

/**
 * Group container for a conversation. DMs and group chats share one table —
 * `kind` discriminates and `title` is only used for groups.
 */
export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    kind: chatThreadKind("kind").default("dm").notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    createdById: text("created_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Last-message snapshot keeps the thread list cheap to render.
    lastMessageAt: timestamp("last_message_at"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageById: text("last_message_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chat_thread_last_msg_idx").on(table.lastMessageAt)],
);

export const chatMember = pgTable(
  "chat_member",
  {
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: chatMemberRole("role").default("member").notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    // Used to compute unread badge counts and "seen by" indicators.
    lastReadAt: timestamp("last_read_at"),
    // Per-member notification mute toggle.
    isMuted: timestamp("is_muted"),
    leftAt: timestamp("left_at"),
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.userId] }),
    index("chat_member_user_idx").on(table.userId),
  ],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body"),
    attachments: jsonb("attachments")
      .$type<
        {
          url: string;
          kind: "image" | "gif" | "video" | "audio" | "movie" | "review";
          // Movie/review attachments carry refId so we can render rich cards.
          refId?: string | number;
          width?: number;
          height?: number;
          duration?: number;
        }[]
      >()
      .default([])
      .notNull(),
    replyToId: text("reply_to_id"),
    editedAt: timestamp("edited_at"),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("chat_message_thread_created_idx").on(table.threadId, table.createdAt),
    index("chat_message_user_idx").on(table.userId),
    index("chat_message_reply_idx").on(table.replyToId),
  ],
);

export const chatThreadRelations = relations(chatThread, ({ many }) => ({
  members: many(chatMember),
  messages: many(chatMessage),
}));

export const chatMemberRelations = relations(chatMember, ({ one }) => ({
  thread: one(chatThread, {
    fields: [chatMember.threadId],
    references: [chatThread.id],
  }),
  user: one(user, { fields: [chatMember.userId], references: [user.id] }),
}));

export const chatMessageRelations = relations(chatMessage, ({ one }) => ({
  thread: one(chatThread, {
    fields: [chatMessage.threadId],
    references: [chatThread.id],
  }),
  user: one(user, { fields: [chatMessage.userId], references: [user.id] }),
}));
