import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { contentVisibility } from "./visibility";

/** Cached rule-based taste copy (Sense identity core). */
export type TasteSignatureConfidence = "low" | "medium" | "high";

export type TasteArchetype =
	| "forming"
	| "contrarian"
	| "genre-purist"
	| "dual-affinity"
	| "generous"
	| "selective"
	| "genre-led"
	| "eclectic"
	| "curator";

export interface TasteSignatureJson {
	archetype?: TasteArchetype;
	headlineSelf?: string;
	headlineVisitor?: string;
	/** Backward compat — mirrors headlineSelf when dual fields exist */
	headline: string;
	confidence: TasteSignatureConfidence;
}

/**
 * One row per `user`. Holds the Letterboxd-style social handle plus all the
 * customization knobs the planning doc calls out (banner, accent override,
 * favorite films, section order, theme prefs, pronouns, location...).
 *
 * Auth tables stay vendor-managed by Better Auth; this table is owned by
 * the application and is always inserted alongside user creation.
 */
export const profile = pgTable(
	"profile",
	{
		userId: text("user_id")
			.primaryKey()
			.references(() => user.id, { onDelete: "cascade" }),
		// Lowercased letterboxd-style handle: a-z 0-9 _ . - between 2 and 24 chars
		handle: text("handle").notNull().unique(),
		displayName: text("display_name").notNull(),
		bio: text("bio"),
		pronouns: text("pronouns"),
		location: text("location"),
		website: text("website"),
		// Banner image stored in Vercel Blob (or any S3-compatible) — full URL.
		bannerUrl: text("banner_url"),
		// Hex override for the cinematic accent color; null = use Desert Orange.
		accentColor: text("accent_color"),
		// Letterboxd-like "Favorite Films" grid (4–8 TMDb ids).
		favoriteMovieIds: jsonb("favorite_movie_ids")
			.$type<number[]>()
			.default([])
			.notNull(),
		// Drag-and-drop ordering of public profile sections. Default mirrors
		// Letterboxd: about, recently-watched, recent-reviews, popular-lists.
		sectionOrder: jsonb("section_order")
			.$type<string[]>()
			.default([
				"about",
				"favorite_films",
				"recently_watched",
				"recent_reviews",
				"lists",
				"achievements",
			])
			.notNull(),
		// Free-form preference jsonb — keyboard shortcuts, hidden columns, etc.
		preferences: jsonb("preferences")
			.$type<Record<string, unknown>>()
			.default({})
			.notNull(),
		// Lightweight stats cache, updated by triggers/jobs so the profile page
		// doesn't have to run a dozen counts on every render.
		statsCache: jsonb("stats_cache")
			.$type<{
				filmsLogged?: number;
				thisYear?: number;
				following?: number;
				followers?: number;
				reviewsCount?: number;
				listsCount?: number;
				watchlistCount?: number;
				levelPoints?: number;
			}>()
			.default({})
			.notNull(),
		defaultVisibility: contentVisibility("default_visibility")
			.default("public")
			.notNull(),
		isPrivate: boolean("is_private").default(false).notNull(),
		isPro: boolean("is_pro").default(false).notNull(),
		/** Ordered review ids (max 3) shown on profile hero — ST.3 signature reviews. */
		pinnedReviewIds: jsonb("pinned_review_ids")
			.$type<string[]>()
			.default([])
			.notNull(),
		/** Auto-generated taste headline — see `recomputeUserTasteSignature`. */
		tasteSignature: jsonb("taste_signature").$type<TasteSignatureJson | null>(),
		tasteSignatureComputedAt: timestamp("taste_signature_computed_at"),
		onboardedAt: timestamp("onboarded_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("profile_handle_lower_idx").on(table.handle),
		index("profile_display_name_idx").on(table.displayName),
	],
);

/**
 * Directed graph: A follows B. The composite PK guarantees uniqueness;
 * lookups in either direction get their own index.
 */
export const follow = pgTable(
	"follow",
	{
		followerId: text("follower_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		followingId: text("following_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		// Mutual-follow flag is denormalized for fast "are these two friends?"
		// checks; both rows toggle this when reciprocal.
		isMutual: boolean("is_mutual").default(false).notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.followerId, table.followingId] }),
		index("follow_following_idx").on(table.followingId),
		index("follow_follower_idx").on(table.followerId),
	],
);

/**
 * "Block" relation — distinct from `follow` so we can enforce visibility
 * rules without consulting two tables.
 */
export const block = pgTable(
	"block",
	{
		blockerId: text("blocker_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		blockedId: text("blocked_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		reason: text("reason"),
	},
	(table) => [
		primaryKey({ columns: [table.blockerId, table.blockedId] }),
		index("block_blocked_idx").on(table.blockedId),
	],
);

/** Helper type for the section_order jsonb so app code stays typed. */
export type ProfileSection =
	| "about"
	| "favorite_films"
	| "recently_watched"
	| "recent_reviews"
	| "lists"
	| "achievements"
	| "stats"
	| "diary";

export const profileRelations = relations(profile, ({ one }) => ({
	user: one(user, {
		fields: [profile.userId],
		references: [user.id],
	}),
}));

export const followRelations = relations(follow, ({ one }) => ({
	follower: one(user, {
		fields: [follow.followerId],
		references: [user.id],
		relationName: "follower",
	}),
	following: one(user, {
		fields: [follow.followingId],
		references: [user.id],
		relationName: "following",
	}),
}));
