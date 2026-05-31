-- Phase 0 retention metrics: first-party funnel events (separate from badge event_log).
CREATE TABLE IF NOT EXISTS "product_event" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "product_event_user_kind_idx" ON "product_event" ("user_id", "kind");
CREATE INDEX IF NOT EXISTS "product_event_kind_created_idx" ON "product_event" ("kind", "created_at");
