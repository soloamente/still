-- Per-person Notify bell — release/streaming alerts when true (default on).
ALTER TABLE "person_favorite" ADD COLUMN IF NOT EXISTS "alerts_enabled" boolean DEFAULT true NOT NULL;
