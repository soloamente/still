-- Backfill stats_cache for all existing profiles from authoritative tables.
-- Profiles created after the increment patches already have live counts;
-- this one-time migration catches up legacy rows.
UPDATE "profile"
SET "stats_cache" = jsonb_build_object(
    'followers', (
        SELECT COUNT(*) FROM "follow" WHERE "follow"."following_id" = "profile"."user_id"
    ),
    'following', (
        SELECT COUNT(*) FROM "follow" WHERE "follow"."follower_id" = "profile"."user_id"
    ),
    'logCount', (
        SELECT COUNT(*) FROM "log"
        WHERE "log"."user_id" = "profile"."user_id"
          AND "log"."removed_at" IS NULL
    )
);
