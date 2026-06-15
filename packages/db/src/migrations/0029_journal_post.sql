CREATE TABLE IF NOT EXISTS "journal_post" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"dek" text,
	"body" text NOT NULL,
	"hero_image_url" text,
	"author_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"status" text NOT NULL DEFAULT 'draft',
	"published_at" timestamp,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_post_status_published_at_idx"
	ON "journal_post" ("status", "published_at" DESC);
