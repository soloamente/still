CREATE TABLE IF NOT EXISTS "taste_dismissed_tv" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tv_tmdb_id" integer NOT NULL,
	"dismissed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taste_dismissed_tv_user_tv_uk" ON "taste_dismissed_tv" ("user_id", "tv_tmdb_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "taste_dismissed_tv_user_idx" ON "taste_dismissed_tv" ("user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "taste_dismissed_tv" ADD CONSTRAINT "taste_dismissed_tv_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
