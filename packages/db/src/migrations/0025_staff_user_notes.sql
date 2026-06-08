CREATE TABLE IF NOT EXISTS "staff_user_note" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_user_note_user_idx" ON "staff_user_note" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_user_note_created_idx" ON "staff_user_note" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_user_note" ADD CONSTRAINT "staff_user_note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "staff_user_note" ADD CONSTRAINT "staff_user_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
