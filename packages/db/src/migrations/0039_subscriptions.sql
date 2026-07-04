ALTER TABLE "profile" ADD COLUMN "subscription_tier" text DEFAULT 'still' NOT NULL;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "plan_override" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "polar_customer_id" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "polar_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "subscription_interval" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "subscription_status" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "referred_by_user_id" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "referral_discount_redeemed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "referral_code" text;
--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_referred_by_user_id_user_id_fk" FOREIGN KEY ("referred_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "profile_referral_code_unique" ON "profile" ("referral_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profile_referred_by_user_idx" ON "profile" ("referred_by_user_id");
--> statement-breakpoint
ALTER TABLE "plan_feature" ADD COLUMN "key" text;
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'log_movies_tv' WHERE "name" ILIKE '%Log movies%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'watchlist_ratings' WHERE "name" ILIKE '%Watchlist & ratings%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'reviews_lists' WHERE "name" ILIKE '%Reviews & lists%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'follow_feed' WHERE "name" ILIKE '%Follow & social%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'import_services' WHERE "name" ILIKE '%Import from%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'tv_episode_progress' WHERE "name" ILIKE '%TV episode progress%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'basic_streaks_badges' WHERE "name" ILIKE '%Basic streaks%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'year_in_review' WHERE "name" ILIKE '%Year in review%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'full_stats' WHERE "name" ILIKE '%Full stats%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'taste_signature' WHERE "name" ILIKE '%Taste signature%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'activity_signature' WHERE "name" ILIKE '%Activity signature%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'streaming_filters' WHERE "name" ILIKE '%Streaming filters%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'watchlist_alerts' WHERE "name" ILIKE '%Watchlist alerts%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'theater_listings' WHERE "name" ILIKE '%Theater listings%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'advanced_feed_filters' WHERE "name" ILIKE '%Advanced feed filters%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'all_themes' WHERE "name" ILIKE '%All themes%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'profile_customization' WHERE "name" ILIKE '%Profile customization%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'pinned_reviews' WHERE "name" ILIKE '%Pinned reviews%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'private_lists' WHERE "name" ILIKE '%Private lists%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'taste_overlap' WHERE "name" ILIKE '%Taste overlap%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'rivalry_mode' WHERE "name" ILIKE '%Rivalry mode%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'badge_prestige' WHERE "name" ILIKE '%Full badge collection%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'challenges' WHERE "name" ILIKE '%Completionist challenges%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'leaderboard_visibility' WHERE "name" ILIKE '%Leaderboard visibility%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'vote_on_features' WHERE "name" ILIKE '%Vote on upcoming features%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'beta_access' WHERE "name" ILIKE '%Beta access%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'direct_feedback_channel' WHERE "name" ILIKE '%Direct feedback channel%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'inner_circle_community' WHERE "name" ILIKE '%Inner circle community%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'app_credits' WHERE "name" ILIKE '%Name in app credits%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'devoted_badge' WHERE "name" ILIKE '%Devoted badge on profile%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'supporters_page' WHERE "name" ILIKE '%Public supporters page%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'seasonal_themes' WHERE "name" ILIKE '%Seasonal exclusive themes%';
--> statement-breakpoint
UPDATE "plan_feature" SET "key" = 'devoted_badges' WHERE "name" ILIKE '%Rare Devoted-only badges%';
--> statement-breakpoint
ALTER TABLE "plan_feature" ALTER COLUMN "key" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plan_feature_key_unique" ON "plan_feature" ("key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plan_feature_grant" (
	"user_id" text NOT NULL,
	"feature_key" text NOT NULL,
	"granted_by" text NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plan_feature_grant_user_id_feature_key_pk" PRIMARY KEY("user_id","feature_key")
);
--> statement-breakpoint
ALTER TABLE "plan_feature_grant" ADD CONSTRAINT "plan_feature_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plan_feature_grant" ADD CONSTRAINT "plan_feature_grant_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plan_feature_grant_user_idx" ON "plan_feature_grant" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patron_referral" (
	"id" text PRIMARY KEY NOT NULL,
	"referrer_user_id" text NOT NULL,
	"referee_user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"qualified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patron_referral" ADD CONSTRAINT "patron_referral_referrer_user_id_user_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "patron_referral" ADD CONSTRAINT "patron_referral_referee_user_id_user_id_fk" FOREIGN KEY ("referee_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "patron_referral_referee_user_idx" ON "patron_referral" ("referee_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_referral_referrer_user_idx" ON "patron_referral" ("referrer_user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patron_referral_reward" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"milestone_key" text NOT NULL,
	"reward_type" text NOT NULL,
	"fulfilled_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
ALTER TABLE "patron_referral_reward" ADD CONSTRAINT "patron_referral_reward_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_referral_reward_user_idx" ON "patron_referral_reward" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_referral_reward_milestone_idx" ON "patron_referral_reward" ("user_id", "milestone_key");
--> statement-breakpoint
UPDATE "profile" SET "plan_override" = 'immersed' WHERE "is_pro" = true;
