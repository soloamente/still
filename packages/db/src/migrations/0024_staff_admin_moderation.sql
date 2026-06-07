ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ban_expires" timestamp;--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN IF NOT EXISTS "removed_by" text;--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN IF NOT EXISTS "removal_reason" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "removed_by" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "removal_reason" text;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "removed_by" text;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "removal_reason" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "removed_by" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "removal_reason" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "staff_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_audit_actor_idx" ON "staff_audit_log" ("actor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_audit_created_idx" ON "staff_audit_log" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_audit_log" ADD CONSTRAINT "staff_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
