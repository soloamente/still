-- Sense Tier 0: cached auto-generated taste copy for profile identity.
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "taste_signature" jsonb;
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "taste_signature_computed_at" timestamp;
