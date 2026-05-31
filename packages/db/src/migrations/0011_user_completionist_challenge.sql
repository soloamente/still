CREATE TABLE IF NOT EXISTS "user_completionist_challenge" (
	"user_id" text NOT NULL,
	"challenge_id" text NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "user_completionist_challenge_user_id_challenge_id_pk" PRIMARY KEY("user_id","challenge_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_completionist_challenge" ADD CONSTRAINT "user_completionist_challenge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_completionist_challenge_user_idx" ON "user_completionist_challenge" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_completionist_challenge_open_idx" ON "user_completionist_challenge" USING btree ("user_id","completed_at");
