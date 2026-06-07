-- Patron-chosen TMDb backdrop slide key for review reader hero (`buildScreenshotSlides` keys).
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "still_slide_key" text;
