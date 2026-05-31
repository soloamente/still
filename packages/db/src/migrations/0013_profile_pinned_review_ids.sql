-- ST.3: up to 3 signature reviews pinned on patron profile (ordered jsonb array).
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "pinned_review_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
