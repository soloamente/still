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
import { tv } from "./tv";

/** Patron lifecycle for an in-progress TV series (separate from watchlist). */
export type TvWatchStatus =
	| "watching"
	| "paused"
	| "abandoned"
	| "finished"
	| "rewatching";

/** How progress is surfaced on the show page — season milestones vs per-episode checklist. */
export type TvProgressMode = "season" | "episode";

/**
 * One row per patron + show — tracks status, progress mode, and continue pointer.
 * Diary moments stay on `log`; this table is the Trakt-style tracker.
 */
export const tvWatch = pgTable(
	"tv_watch",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tvId: integer("tv_id")
			.notNull()
			.references(() => tv.tmdbId, { onDelete: "restrict" }),
		status: text("status").$type<TvWatchStatus>().notNull().default("watching"),
		progressMode: text("progress_mode")
			.$type<TvProgressMode>()
			.notNull()
			.default("season"),
		lastSeason: smallint("last_season"),
		lastEpisode: smallint("last_episode"),
		notifyNewEpisodes: boolean("notify_new_episodes").default(true).notNull(),
		startedAt: timestamp("started_at").defaultNow().notNull(),
		statusChangedAt: timestamp("status_changed_at").defaultNow().notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("tv_watch_user_tv_uk").on(table.userId, table.tvId),
		index("tv_watch_user_status_idx").on(table.userId, table.status),
	],
);

/** Episode-level checkmarks when `progress_mode` is `episode` (or for season-mode bookkeeping). */
export const tvWatchEpisode = pgTable(
	"tv_watch_episode",
	{
		tvWatchId: text("tv_watch_id")
			.notNull()
			.references(() => tvWatch.id, { onDelete: "cascade" }),
		seasonNumber: smallint("season_number").notNull(),
		episodeNumber: smallint("episode_number").notNull(),
		watchedAt: timestamp("watched_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("tv_watch_episode_uk").on(
			table.tvWatchId,
			table.seasonNumber,
			table.episodeNumber,
		),
	],
);

export const tvWatchRelations = relations(tvWatch, ({ one, many }) => ({
	user: one(user, { fields: [tvWatch.userId], references: [user.id] }),
	tv: one(tv, { fields: [tvWatch.tvId], references: [tv.tmdbId] }),
	episodes: many(tvWatchEpisode),
}));

export const tvWatchEpisodeRelations = relations(tvWatchEpisode, ({ one }) => ({
	tvWatch: one(tvWatch, {
		fields: [tvWatchEpisode.tvWatchId],
		references: [tvWatch.id],
	}),
}));
