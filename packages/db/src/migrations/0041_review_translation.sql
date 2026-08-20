-- Review translation: detected source language on the review itself, plus a
-- durable per-language cache so a given review is only ever paid for once per
-- target language (Redis in front is just a hot path, not the source of truth).
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "source_language" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "review_translation" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL REFERENCES "review"("id") ON DELETE CASCADE,
	"target_language" text NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_translation_review_language_uk" UNIQUE ("review_id", "target_language")
);
