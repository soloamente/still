import { relations } from "drizzle-orm";
import {
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
} from "drizzle-orm/pg-core";

/** Static reference rows — seeded once, never deleted via UI. */
export const planTier = pgTable("plan_tier", {
	id: text("id").primaryKey(), // "still" | "attuned" | "immersed" | "devoted"
	name: text("name").notNull(),
	sortOrder: integer("sort_order").notNull(),
	priceYearly: integer("price_yearly"), // cents, null = free
	priceMonthly: integer("price_monthly"), // cents, null = free
	tagline: text("tagline").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const planFeature = pgTable("plan_feature", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description").notNull(),
	buildStatus: text("build_status").notNull().default("planned"), // "exists" | "planned"
	sortOrder: integer("sort_order").notNull().default(0),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Which tiers include a feature. */
export const planFeatureTier = pgTable(
	"plan_feature_tier",
	{
		featureId: text("feature_id")
			.notNull()
			.references(() => planFeature.id, { onDelete: "cascade" }),
		tierId: text("tier_id")
			.notNull()
			.references(() => planTier.id, { onDelete: "cascade" }),
	},
	(table) => [primaryKey({ columns: [table.featureId, table.tierId] })],
);

export const planTierRelations = relations(planTier, ({ many }) => ({
	featureTiers: many(planFeatureTier),
}));

export const planFeatureRelations = relations(planFeature, ({ many }) => ({
	featureTiers: many(planFeatureTier),
}));

export const planFeatureTierRelations = relations(
	planFeatureTier,
	({ one }) => ({
		feature: one(planFeature, {
			fields: [planFeatureTier.featureId],
			references: [planFeature.id],
		}),
		tier: one(planTier, {
			fields: [planFeatureTier.tierId],
			references: [planTier.id],
		}),
	}),
);
