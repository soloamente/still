-- Optional voice review attachment (Vercel Blob URL + client-reported duration).
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "audio_url" text;
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "audio_duration_ms" integer;
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "audio_mime_type" text;
