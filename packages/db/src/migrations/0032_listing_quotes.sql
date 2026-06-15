CREATE TYPE "listing_quote_source" AS ENUM ('external_api', 'staff', 'patron');
--> statement-breakpoint
CREATE TYPE "quote_submission_status" AS ENUM ('pending', 'approved', 'rejected');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_quote" (
	"id" text PRIMARY KEY NOT NULL,
	"movie_id" integer REFERENCES "movie"("tmdb_id") ON DELETE CASCADE,
	"tv_id" integer REFERENCES "tv"("tmdb_id") ON DELETE CASCADE,
	"season_number" smallint,
	"episode_number" smallint,
	"body" text NOT NULL,
	"speaker" text,
	"timestamp_ms" integer,
	"source" "listing_quote_source" NOT NULL,
	"submitted_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"external_provider" text,
	"external_id" text,
	"upvote_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_quote_movie_xor_tv" CHECK (
		("movie_id" IS NOT NULL AND "tv_id" IS NULL)
		OR ("movie_id" IS NULL AND "tv_id" IS NOT NULL)
	),
	CONSTRAINT "listing_quote_tv_episode_required" CHECK (
		"tv_id" IS NULL OR ("season_number" IS NOT NULL AND "episode_number" IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "listing_quote_external_uk"
	ON "listing_quote" ("external_provider", "external_id")
	WHERE "external_provider" IS NOT NULL AND "external_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_quote_movie_upvotes_idx"
	ON "listing_quote" ("movie_id", "upvote_count" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_quote_tv_episode_upvotes_idx"
	ON "listing_quote" ("tv_id", "season_number", "episode_number", "upvote_count" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_quote_upvote" (
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"quote_id" text NOT NULL REFERENCES "listing_quote"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("user_id", "quote_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "listing_quote_save" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"quote_id" text NOT NULL REFERENCES "listing_quote"("id") ON DELETE CASCADE,
	"visibility" "content_visibility" DEFAULT 'private' NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_quote_save_user_quote_uk" UNIQUE ("user_id", "quote_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "listing_quote_save_user_idx"
	ON "listing_quote_save" ("user_id", "saved_at" DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"movie_id" integer REFERENCES "movie"("tmdb_id") ON DELETE CASCADE,
	"tv_id" integer REFERENCES "tv"("tmdb_id") ON DELETE CASCADE,
	"season_number" smallint,
	"episode_number" smallint,
	"body" text NOT NULL,
	"speaker" text,
	"timestamp_ms" integer,
	"status" "quote_submission_status" DEFAULT 'pending' NOT NULL,
	"staff_note" text,
	"reviewed_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"reviewed_at" timestamp with time zone,
	"resolved_quote_id" text REFERENCES "listing_quote"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_submission_movie_xor_tv" CHECK (
		("movie_id" IS NOT NULL AND "tv_id" IS NULL)
		OR ("movie_id" IS NULL AND "tv_id" IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quote_submission_pending_idx"
	ON "quote_submission" ("status", "created_at" DESC);
