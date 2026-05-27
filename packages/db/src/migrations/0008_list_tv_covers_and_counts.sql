-- TV list covers + split item counts for add-to-list picker meta
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "cover_tv_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "movie_items_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "tv_items_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "list" SET
  "movie_items_count" = COALESCE((
    SELECT count(*)::integer FROM "list_item"
    WHERE "list_item"."list_id" = "list"."id" AND "list_item"."movie_id" IS NOT NULL
  ), 0),
  "tv_items_count" = COALESCE((
    SELECT count(*)::integer FROM "list_item"
    WHERE "list_item"."list_id" = "list"."id" AND "list_item"."tv_id" IS NOT NULL
  ), 0);--> statement-breakpoint
UPDATE "list" SET "items_count" = "movie_items_count" + "tv_items_count";
