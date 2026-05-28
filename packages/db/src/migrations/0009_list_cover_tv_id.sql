-- Pin one TV show poster as list hero cover (parallel to cover_movie_id).
ALTER TABLE "list" ADD COLUMN IF NOT EXISTS "cover_tv_id" integer;
