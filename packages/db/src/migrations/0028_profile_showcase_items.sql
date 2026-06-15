-- Profile identity showcase: up to 4 curated film/TV/review slots (Letterboxd pillars).
ALTER TABLE "profile" ADD COLUMN IF NOT EXISTS "showcase_items" jsonb DEFAULT '[]'::jsonb NOT NULL;
