import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Patron-saved TMDb cast/crew — separate from diary title Favorites (`log.liked`).
 * One row per (user, person); alerts fire when `alertsEnabled` is true.
 */
export const personFavorite = pgTable(
	"person_favorite",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbPersonId: integer("tmdb_person_id").notNull(),
		/** Snapshot at save / refresh for drawer + inbox copy without a live TMDb hit. */
		name: text("name").notNull(),
		profileUrl: text("profile_url"),
		knownForDepartment: text("known_for_department"),
		/** Per-person release/streaming inbox alerts (Notify bell on person detail). */
		alertsEnabled: boolean("alerts_enabled").default(true).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("person_favorite_user_person_uk").on(
			table.userId,
			table.tmdbPersonId,
		),
		index("person_favorite_user_created_idx").on(table.userId, table.createdAt),
	],
);

/**
 * Credits already baseline'd or alerted for a favorited person — prevents re-notify storms.
 * `roleKey` is a normalized cast character / crew job fingerprint.
 */
export const personFavoriteCreditSeen = pgTable(
	"person_favorite_credit_seen",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		tmdbPersonId: integer("tmdb_person_id").notNull(),
		/** `movie` | `tv` */
		mediaKind: text("media_kind").notNull(),
		tmdbId: integer("tmdb_id").notNull(),
		roleKey: text("role_key").notNull(),
		seenAt: timestamp("seen_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("person_favorite_credit_seen_uk").on(
			table.userId,
			table.tmdbPersonId,
			table.mediaKind,
			table.tmdbId,
			table.roleKey,
		),
		index("person_favorite_credit_seen_user_person_idx").on(
			table.userId,
			table.tmdbPersonId,
		),
	],
);

export const personFavoriteRelations = relations(personFavorite, ({ one }) => ({
	user: one(user, {
		fields: [personFavorite.userId],
		references: [user.id],
	}),
}));

export const personFavoriteCreditSeenRelations = relations(
	personFavoriteCreditSeen,
	({ one }) => ({
		user: one(user, {
			fields: [personFavoriteCreditSeen.userId],
			references: [user.id],
		}),
	}),
);
