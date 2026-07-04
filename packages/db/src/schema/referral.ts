import { relations } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/** Staff-granted feature access above tier — never removes tier-implied access. */
export const planFeatureGrant = pgTable(
	"plan_feature_grant",
	{
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** Matches plan_feature.key — not a FK so grants survive catalogue reshuffles. */
		featureKey: text("feature_key").notNull(),
		grantedBy: text("granted_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		grantedAt: timestamp("granted_at").defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.featureKey] }),
		index("plan_feature_grant_user_idx").on(table.userId),
	],
);

/** Referral lifecycle — one row per referred sign-up. */
export const patronReferral = pgTable(
	"patron_referral",
	{
		id: text("id").primaryKey(),
		referrerUserId: text("referrer_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		refereeUserId: text("referee_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		/** pending → qualified (onboarded) or void (fraud/duplicate). */
		status: text("status").notNull().default("pending"),
		qualifiedAt: timestamp("qualified_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("patron_referral_referee_user_idx").on(table.refereeUserId),
		index("patron_referral_referrer_user_idx").on(table.referrerUserId),
	],
);

/** Audit trail when a referrer milestone reward is fulfilled. */
export const patronReferralReward = pgTable(
	"patron_referral_reward",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		milestoneKey: text("milestone_key").notNull(),
		rewardType: text("reward_type").notNull(),
		fulfilledAt: timestamp("fulfilled_at").defaultNow().notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
	},
	(table) => [
		index("patron_referral_reward_user_idx").on(table.userId),
		index("patron_referral_reward_milestone_idx").on(
			table.userId,
			table.milestoneKey,
		),
	],
);

export const planFeatureGrantRelations = relations(
	planFeatureGrant,
	({ one }) => ({
		user: one(user, {
			fields: [planFeatureGrant.userId],
			references: [user.id],
			relationName: "planFeatureGrantUser",
		}),
		grantedByUser: one(user, {
			fields: [planFeatureGrant.grantedBy],
			references: [user.id],
			relationName: "planFeatureGrantGrantedBy",
		}),
	}),
);

export const patronReferralRelations = relations(patronReferral, ({ one }) => ({
	referrer: one(user, {
		fields: [patronReferral.referrerUserId],
		references: [user.id],
		relationName: "patronReferralReferrer",
	}),
	referee: one(user, {
		fields: [patronReferral.refereeUserId],
		references: [user.id],
		relationName: "patronReferralReferee",
	}),
}));

export const patronReferralRewardRelations = relations(
	patronReferralReward,
	({ one }) => ({
		user: one(user, {
			fields: [patronReferralReward.userId],
			references: [user.id],
		}),
	}),
);
