ALTER TABLE "profile" ADD COLUMN "pinned_quote_save_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
