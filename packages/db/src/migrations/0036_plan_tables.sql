CREATE TABLE "plan_tier" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"price_yearly" integer,
	"price_monthly" integer,
	"tagline" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_feature" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"build_status" text DEFAULT 'planned' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_feature_tier" (
	"feature_id" text NOT NULL,
	"tier_id" text NOT NULL,
	CONSTRAINT "plan_feature_tier_feature_id_tier_id_pk" PRIMARY KEY("feature_id","tier_id")
);
--> statement-breakpoint
ALTER TABLE "plan_feature_tier" ADD CONSTRAINT "plan_feature_tier_feature_id_plan_feature_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."plan_feature"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "plan_feature_tier" ADD CONSTRAINT "plan_feature_tier_tier_id_plan_tier_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."plan_tier"("id") ON DELETE cascade ON UPDATE no action;
