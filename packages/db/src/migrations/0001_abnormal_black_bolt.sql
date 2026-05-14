ALTER TABLE "movie" ADD COLUMN IF NOT EXISTS "palette_accent" text;--> statement-breakpoint
ALTER TABLE "movie" ADD COLUMN IF NOT EXISTS "palette_muted" text;--> statement-breakpoint
ALTER TABLE "movie" ADD COLUMN IF NOT EXISTS "palette_foreground" text;