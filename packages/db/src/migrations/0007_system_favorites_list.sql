-- System favorites list + TV rows on list_item
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "system_kind" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "list_user_favorites_uk" ON "list" ("user_id") WHERE "system_kind" = 'favorites';--> statement-breakpoint
ALTER TABLE "list_item" ADD COLUMN IF NOT EXISTS "id" text;--> statement-breakpoint
UPDATE "list_item" SET "id" = "list_id" || ':m:' || "movie_id"::text WHERE "id" IS NULL;--> statement-breakpoint
ALTER TABLE "list_item" DROP CONSTRAINT IF EXISTS "list_item_pkey";--> statement-breakpoint
ALTER TABLE "list_item" DROP CONSTRAINT IF EXISTS "list_item_list_id_movie_id_pk";--> statement-breakpoint
ALTER TABLE "list_item" ALTER COLUMN "movie_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "list_item" ADD COLUMN IF NOT EXISTS "tv_id" integer;--> statement-breakpoint
ALTER TABLE "list_item" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_pkey" PRIMARY KEY ("id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "list_item" ADD CONSTRAINT "list_item_tv_id_tv_tmdb_id_fk" FOREIGN KEY ("tv_id") REFERENCES "public"."tv"("tmdb_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "list_item" ADD CONSTRAINT "list_item_movie_xor_tv" CHECK (("list_item"."movie_id" IS NOT NULL AND "list_item"."tv_id" IS NULL) OR ("list_item"."movie_id" IS NULL AND "list_item"."tv_id" IS NOT NULL));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "list_item_list_movie_uk" ON "list_item" ("list_id","movie_id") WHERE "list_item"."movie_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "list_item_list_tv_uk" ON "list_item" ("list_id","tv_id") WHERE "list_item"."tv_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "list_item_tv_idx" ON "list_item" ("tv_id");
