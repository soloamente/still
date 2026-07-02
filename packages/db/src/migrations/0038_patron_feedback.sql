CREATE TYPE "patron_feedback_category" AS ENUM ('bug', 'idea', 'other');
--> statement-breakpoint
CREATE TYPE "patron_feedback_status" AS ENUM ('open', 'resolved', 'dismissed');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patron_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"category" "patron_feedback_category" NOT NULL,
	"body" text NOT NULL,
	"page_url" text,
	"status" "patron_feedback_status" DEFAULT 'open' NOT NULL,
	"last_staff_reply_at" timestamp with time zone,
	"patron_last_read_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_feedback_user_created_idx"
	ON "patron_feedback" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_feedback_status_created_idx"
	ON "patron_feedback" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patron_feedback_reply" (
	"id" text PRIMARY KEY NOT NULL,
	"feedback_id" text NOT NULL REFERENCES "patron_feedback"("id") ON DELETE CASCADE,
	"author_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_feedback_reply_feedback_idx"
	ON "patron_feedback_reply" ("feedback_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "patron_feedback_staff_note" (
	"id" text PRIMARY KEY NOT NULL,
	"feedback_id" text NOT NULL REFERENCES "patron_feedback"("id") ON DELETE CASCADE,
	"author_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patron_feedback_staff_note_feedback_idx"
	ON "patron_feedback_staff_note" ("feedback_id", "created_at");
