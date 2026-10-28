-- Bind each stored translation to the exact text/model/prompt it came from.
-- Rows are only reused when this hash matches the review's current fingerprint,
-- so edits (including title-only ones) and model/prompt changes can never serve
-- stale text. Nullable: existing rows have no hash, never match, and are simply
-- overwritten the next time that review is translated.
ALTER TABLE "review_translation" ADD COLUMN IF NOT EXISTS "source_hash" text;
