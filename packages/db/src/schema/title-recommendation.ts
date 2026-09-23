import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { movie } from "./movie";
import { tv } from "./tv";

/** Optional preset reason on a patron-to-patron title recommendation. */
export type TitleRecommendationReasonCode =
	| "same_mood"
	| "because_you_liked"
	| "hidden_gem"
	| "watch_together"
	| "you_would_love";

/**
 * Patron-sent film/TV pick for someone they follow — powers Today on Sense
 * **Recommend back** and inbox delivery (open → accept → answer funnel).
 */
export const titleRecommendation = pgTable(
	"title_recommendation",
	{
		id: text("id").primaryKey(),
		senderUserId: text("sender_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		recipientUserId: text("recipient_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		movieId: integer("movie_id").references(() => movie.tmdbId, {
			onDelete: "restrict",
		}),
		tvId: integer("tv_id").references(() => tv.tmdbId, {
			onDelete: "restrict",
		}),
		reasonCode: text(
			"reason_code",
		).$type<TitleRecommendationReasonCode | null>(),
		/** Short free-text note — capped at 280 chars in DB. */
		note: text("note"),
		/** When true, notification chrome omits title/artwork preview for sensitive sends. */
		sensitiveScrub: boolean("sensitive_scrub").default(false).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		openedAt: timestamp("opened_at", { withTimezone: true }),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }),
		answeredAt: timestamp("answered_at", { withTimezone: true }),
		/** Links a reciprocal send back to the recommendation that prompted it. */
		answerRecommendationId: text("answer_recommendation_id").references(
			(): AnyPgColumn => titleRecommendation.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		check(
			"title_recommendation_movie_xor_tv",
			sql`(${table.movieId} IS NOT NULL AND ${table.tvId} IS NULL) OR (${table.movieId} IS NULL AND ${table.tvId} IS NOT NULL)`,
		),
		check(
			"title_recommendation_note_len",
			sql`${table.note} IS NULL OR char_length(${table.note}) <= 280`,
		),
		index("title_recommendation_recipient_created_idx").on(
			table.recipientUserId,
			table.createdAt,
		),
		index("title_recommendation_sender_created_idx").on(
			table.senderUserId,
			table.createdAt,
		),
		index("title_recommendation_movie_idx").on(table.movieId),
		index("title_recommendation_tv_idx").on(table.tvId),
	],
);

export const titleRecommendationRelations = relations(
	titleRecommendation,
	({ one }) => ({
		sender: one(user, {
			fields: [titleRecommendation.senderUserId],
			references: [user.id],
			relationName: "titleRecommendationSender",
		}),
		recipient: one(user, {
			fields: [titleRecommendation.recipientUserId],
			references: [user.id],
			relationName: "titleRecommendationRecipient",
		}),
		movie: one(movie, {
			fields: [titleRecommendation.movieId],
			references: [movie.tmdbId],
		}),
		tv: one(tv, {
			fields: [titleRecommendation.tvId],
			references: [tv.tmdbId],
		}),
		answerRecommendation: one(titleRecommendation, {
			fields: [titleRecommendation.answerRecommendationId],
			references: [titleRecommendation.id],
			relationName: "titleRecommendationAnswer",
		}),
	}),
);
