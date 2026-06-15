import { relations, sql } from "drizzle-orm";
import {
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

/**
 * Last-known flatrate provider ids per watchlist title + patron region.
 * Compared on each sync pass to detect newly available streaming services.
 */
export const watchlistStreamingSnapshot = pgTable(
	"watchlist_streaming_snapshot",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "cascade",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "cascade",
		}),
		region: text("region").notNull(),
		providerIds: jsonb("provider_ids").$type<number[]>().default([]).notNull(),
		checkedAt: timestamp("checked_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		check(
			"watchlist_streaming_snapshot_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		uniqueIndex("watchlist_streaming_snapshot_user_movie_region_uk")
			.on(table.userId, table.movieId, table.region)
			.where(sql`${table.movieId} IS NOT NULL`),
		uniqueIndex("watchlist_streaming_snapshot_user_tv_region_uk")
			.on(table.userId, table.tvId, table.region)
			.where(sql`${table.tvId} IS NOT NULL`),
		index("watchlist_streaming_snapshot_user_checked_idx").on(
			table.userId,
			table.checkedAt,
		),
	],
);

export const watchlistStreamingSnapshotRelations = relations(
	watchlistStreamingSnapshot,
	({ one }) => ({
		user: one(user, {
			fields: [watchlistStreamingSnapshot.userId],
			references: [user.id],
		}),
		movie: one(movie, {
			fields: [watchlistStreamingSnapshot.movieId],
			references: [movie.tmdbId],
		}),
		tv: one(tv, {
			fields: [watchlistStreamingSnapshot.tvId],
			references: [tv.tmdbId],
		}),
	}),
);
