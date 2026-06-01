-- Per-item visibility for reviews and diary logs, plus an account-level default.
CREATE TYPE "content_visibility" AS ENUM ('public', 'followers', 'friends', 'private');

-- review: replace boolean is_public with the visibility enum (backfill before drop).
ALTER TABLE "review" ADD COLUMN "visibility" "content_visibility" NOT NULL DEFAULT 'public';
UPDATE "review" SET "visibility" = CASE WHEN "is_public" THEN 'public' ELSE 'private' END;
ALTER TABLE "review" DROP COLUMN "is_public";

-- log: new column; every existing row is effectively public today.
ALTER TABLE "log" ADD COLUMN "visibility" "content_visibility" NOT NULL DEFAULT 'public';

-- profile: account-level default applied to newly created content.
ALTER TABLE "profile" ADD COLUMN "default_visibility" "content_visibility" NOT NULL DEFAULT 'public';

-- Indexes to keep filtered reads fast.
CREATE INDEX "review_visibility_idx" ON "review" ("visibility");
CREATE INDEX "log_visibility_idx" ON "log" ("visibility");
