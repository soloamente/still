import { relations, sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgEnum,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { movie } from "./movie";
import { tv } from "./tv";
import { contentVisibility } from "./visibility";

/** How a published quote entered the catalog. */
export const listingQuoteSource = pgEnum("listing_quote_source", [
	"external_api",
	"staff",
	"patron",
]);

export type ListingQuoteSource = (typeof listingQuoteSource.enumValues)[number];

/** Patron submit → staff moderation lifecycle. */
export const quoteSubmissionStatus = pgEnum("quote_submission_status", [
	"pending",
	"approved",
	"rejected",
]);

export type QuoteSubmissionStatus =
	(typeof quoteSubmissionStatus.enumValues)[number];

/** Published dialogue quote on a film or TV episode. */
export const listingQuote = pgTable(
	"listing_quote",
	{
		id: text("id").primaryKey(),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "cascade",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "cascade",
		}),
		seasonNumber: smallint("season_number"),
		episodeNumber: smallint("episode_number"),
		body: text("body").notNull(),
		speaker: text("speaker"),
		timestampMs: integer("timestamp_ms"),
		source: listingQuoteSource("source").notNull(),
		submittedByUserId: text("submitted_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		externalProvider: text("external_provider"),
		externalId: text("external_id"),
		upvoteCount: integer("upvote_count").default(0).notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		check(
			"listing_quote_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		check(
			"listing_quote_tv_episode_required",
			sql`${table.tvId} IS NULL OR (${table.seasonNumber} IS NOT NULL AND ${table.episodeNumber} IS NOT NULL)`,
		),
		uniqueIndex("listing_quote_external_uk")
			.on(table.externalProvider, table.externalId)
			.where(
				sql`${table.externalProvider} IS NOT NULL AND ${table.externalId} IS NOT NULL`,
			),
		index("listing_quote_movie_upvotes_idx").on(
			table.movieId,
			table.upvoteCount,
		),
		index("listing_quote_tv_episode_upvotes_idx").on(
			table.tvId,
			table.seasonNumber,
			table.episodeNumber,
			table.upvoteCount,
		),
	],
);

/** One patron upvote per quote — toggle insert/delete. */
export const listingQuoteUpvote = pgTable(
	"listing_quote_upvote",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		quoteId: text("quote_id")
			.notNull()
			.references(() => listingQuote.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [primaryKey({ columns: [table.userId, table.quoteId] })],
);

/** Patron bookmark — default visibility private. */
export const listingQuoteSave = pgTable(
	"listing_quote_save",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		quoteId: text("quote_id")
			.notNull()
			.references(() => listingQuote.id, { onDelete: "cascade" }),
		visibility: contentVisibility("visibility").default("private").notNull(),
		savedAt: timestamp("saved_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("listing_quote_save_user_quote_uk").on(
			table.userId,
			table.quoteId,
		),
		index("listing_quote_save_user_idx").on(table.userId, table.savedAt),
	],
);

/** Patron-submitted quote awaiting staff review. */
export const quoteSubmission = pgTable(
	"quote_submission",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "cascade",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "cascade",
		}),
		seasonNumber: smallint("season_number"),
		episodeNumber: smallint("episode_number"),
		body: text("body").notNull(),
		speaker: text("speaker"),
		timestampMs: integer("timestamp_ms"),
		status: quoteSubmissionStatus("status").default("pending").notNull(),
		staffNote: text("staff_note"),
		reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, {
			onDelete: "set null",
		}),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		resolvedQuoteId: text("resolved_quote_id").references(
			() => listingQuote.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		check(
			"quote_submission_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		index("quote_submission_pending_idx").on(table.status, table.createdAt),
	],
);

export const listingQuoteRelations = relations(
	listingQuote,
	({ one, many }) => ({
		submittedBy: one(user, {
			fields: [listingQuote.submittedByUserId],
			references: [user.id],
		}),
		movie: one(movie, {
			fields: [listingQuote.movieId],
			references: [movie.tmdbId],
		}),
		tv: one(tv, {
			fields: [listingQuote.tvId],
			references: [tv.tmdbId],
		}),
		upvotes: many(listingQuoteUpvote),
		saves: many(listingQuoteSave),
	}),
);

export const listingQuoteUpvoteRelations = relations(
	listingQuoteUpvote,
	({ one }) => ({
		user: one(user, {
			fields: [listingQuoteUpvote.userId],
			references: [user.id],
		}),
		quote: one(listingQuote, {
			fields: [listingQuoteUpvote.quoteId],
			references: [listingQuote.id],
		}),
	}),
);

export const listingQuoteSaveRelations = relations(
	listingQuoteSave,
	({ one }) => ({
		user: one(user, {
			fields: [listingQuoteSave.userId],
			references: [user.id],
		}),
		quote: one(listingQuote, {
			fields: [listingQuoteSave.quoteId],
			references: [listingQuote.id],
		}),
	}),
);

export const quoteSubmissionRelations = relations(
	quoteSubmission,
	({ one }) => ({
		submitter: one(user, {
			fields: [quoteSubmission.userId],
			references: [user.id],
		}),
		reviewer: one(user, {
			fields: [quoteSubmission.reviewedByUserId],
			references: [user.id],
		}),
		resolvedQuote: one(listingQuote, {
			fields: [quoteSubmission.resolvedQuoteId],
			references: [listingQuote.id],
		}),
	}),
);
