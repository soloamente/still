-- Align review.rating with log.rating tenths (0–100). Legacy whole 1–10 → ×10.

UPDATE "review" AS r
SET "rating" = l."rating"
FROM "log" AS l
WHERE r."log_id" = l."id"
  AND l."rating" IS NOT NULL;

UPDATE "review"
SET "rating" = "rating" * 10
WHERE "log_id" IS NULL
  AND "rating" IS NOT NULL
  AND "rating" BETWEEN 1 AND 10;
