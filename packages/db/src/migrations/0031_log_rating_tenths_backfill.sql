-- Legacy diary/review ratings stored as whole scores 1–10 → tenths (×10).
-- After this, display scale is always stored / 10 (0.1–10.0).

UPDATE "log"
SET "rating" = "rating" * 10
WHERE "rating" IS NOT NULL
  AND "rating" BETWEEN 1 AND 10;

UPDATE "review"
SET "rating" = "rating" * 10
WHERE "rating" IS NOT NULL
  AND "rating" BETWEEN 1 AND 10;
