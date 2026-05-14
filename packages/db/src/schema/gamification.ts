import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Visual tier for badges — drives the gradient/border treatment on the badge card. */
export const badgeTier = pgEnum("badge_tier", ["bronze", "silver", "gold", "platinum", "legendary"]);

/**
 * Canonical badge catalog. `criteria` is declarative jsonb so designers
 * can add new badges without code (the evaluator parses the same shape).
 *
 * Example criteria:
 *   { kind: "logs_count", min: 100 }
 *   { kind: "genre_count", genreId: 27, min: 50 }
 *   { kind: "decade_coverage", min: 10, decades: ["1920","1930", ...] }
 *   { kind: "review_likes", min: 100 }
 */
export const badge = pgTable(
  "badge",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    iconUrl: text("icon_url"),
    tier: badgeTier("tier").default("bronze").notNull(),
    category: text("category"), // "watch_milestone", "social", "curator", "explorer"
    points: integer("points").default(10).notNull(), // contributes to level/XP
    isHidden: boolean("is_hidden").default(false).notNull(),
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("badge_category_idx").on(table.category)],
);

/** Awarded badges. UNIQUE on (userId, badgeId) — you only earn each once. */
export const userBadge = pgTable(
  "user_badge",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    badgeId: text("badge_id")
      .notNull()
      .references(() => badge.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
    // Snapshot of the criteria value that earned it (e.g. "Logged film #100").
    earnedContext: jsonb("earned_context").$type<Record<string, unknown>>(),
    // Did the user "showcase" this badge on their profile?
    isPinned: boolean("is_pinned").default(false).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.badgeId] }),
    index("user_badge_user_pinned_idx").on(table.userId, table.isPinned),
  ],
);

/**
 * Achievements are like badges but track progress. Hidden until close to
 * unlock for surprise factor; declarative criteria same as badges.
 */
export const achievement = pgTable(
  "achievement",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    iconUrl: text("icon_url"),
    points: integer("points").default(25).notNull(),
    isHidden: boolean("is_hidden").default(true).notNull(),
    target: integer("target"), // numeric target for "progress" bars
    criteria: jsonb("criteria").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("achievement_hidden_idx").on(table.isHidden)],
);

export const userAchievement = pgTable(
  "user_achievement",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievement.id, { onDelete: "cascade" }),
    progress: integer("progress").default(0).notNull(),
    progressJson: jsonb("progress_json").$type<Record<string, unknown>>().default({}).notNull(),
    unlockedAt: timestamp("unlocked_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.achievementId] }),
    index("user_achievement_unlocked_idx").on(table.unlockedAt),
  ],
);

/**
 * Tiny event-log table. Domain writes (log created, review liked, list
 * shared...) push a row; the badge evaluator drains it asynchronously.
 * Keeping it in Postgres avoids a queue dependency for v1.
 */
export const eventLog = pgTable(
  "event_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "log.created", "review.liked", ...
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("event_log_unprocessed_idx").on(table.processedAt, table.createdAt),
    index("event_log_user_kind_idx").on(table.userId, table.kind),
    uniqueIndex("event_log_id_uk").on(table.id),
  ],
);

export const badgeRelations = relations(badge, ({ many }) => ({
  awards: many(userBadge),
}));

export const userBadgeRelations = relations(userBadge, ({ one }) => ({
  user: one(user, { fields: [userBadge.userId], references: [user.id] }),
  badge: one(badge, { fields: [userBadge.badgeId], references: [badge.id] }),
}));

export const achievementRelations = relations(achievement, ({ many }) => ({
  progressByUser: many(userAchievement),
}));

export const userAchievementRelations = relations(userAchievement, ({ one }) => ({
  user: one(user, { fields: [userAchievement.userId], references: [user.id] }),
  achievement: one(achievement, {
    fields: [userAchievement.achievementId],
    references: [achievement.id],
  }),
}));
