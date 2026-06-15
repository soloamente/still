-- Legacy patrons completed onboarding before v3 persisted onboarded_at.
-- Do not backfill same-day v3 sign-ups stuck mid-wizard (handle only, no activity).
UPDATE "profile"
SET "onboarded_at" = COALESCE("updated_at", "created_at")
WHERE "onboarded_at" IS NULL
  AND "handle" IS NOT NULL
  AND (
    "created_at" < '2026-06-14'::timestamp
    OR "taste_signature_computed_at" IS NOT NULL
    OR jsonb_array_length("favorite_movie_ids") > 0
    OR EXISTS (
      SELECT 1
      FROM "log"
      WHERE "log"."user_id" = "profile"."user_id"
        AND "log"."removed_at" IS NULL
      LIMIT 1
    )
  );
