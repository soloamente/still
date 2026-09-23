-- Today on Sense: optional category ratings on diary logs, nullable watch venue
-- (unset rows surface in both diary venue slices), and patron title recommendations.

ALTER TABLE "log" ADD COLUMN IF NOT EXISTS "category_ratings" jsonb;
--> statement-breakpoint
ALTER TABLE "log" ALTER COLUMN "watch_venue" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "title_recommendation" (
	"id" text PRIMARY KEY NOT NULL,
	"sender_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"recipient_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"movie_id" integer REFERENCES "movie"("tmdb_id") ON DELETE RESTRICT,
	"tv_id" integer REFERENCES "tv"("tmdb_id") ON DELETE RESTRICT,
	"reason_code" text,
	"note" text,
	"sensitive_scrub" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"answered_at" timestamp with time zone,
	"answer_recommendation_id" text REFERENCES "title_recommendation"("id") ON DELETE SET NULL,
	CONSTRAINT "title_recommendation_movie_xor_tv" CHECK (
		("movie_id" IS NOT NULL AND "tv_id" IS NULL)
		OR ("movie_id" IS NULL AND "tv_id" IS NOT NULL)
	),
	CONSTRAINT "title_recommendation_note_len" CHECK (
		"note" IS NULL OR char_length("note") <= 280
	)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "title_recommendation_recipient_created_idx"
	ON "title_recommendation" ("recipient_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "title_recommendation_sender_created_idx"
	ON "title_recommendation" ("sender_user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "title_recommendation_movie_idx"
	ON "title_recommendation" ("movie_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "title_recommendation_tv_idx"
	ON "title_recommendation" ("tv_id");
