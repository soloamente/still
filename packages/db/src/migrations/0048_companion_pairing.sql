CREATE TABLE IF NOT EXISTS "companion_pair_code" (
	"code_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companion_pair_code_user_idx" ON "companion_pair_code" ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "companion_device" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "companion_device_token_hash_uk" ON "companion_device" ("token_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "companion_device_user_idx" ON "companion_device" ("user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companion_pair_code" ADD CONSTRAINT "companion_pair_code_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "companion_device" ADD CONSTRAINT "companion_device_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
