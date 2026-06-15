CREATE TABLE "watchlist_streaming_snapshot" (
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"movie_id" integer REFERENCES "movie"("tmdb_id") ON DELETE CASCADE,
	"tv_id" integer REFERENCES "tv"("tmdb_id") ON DELETE CASCADE,
	"region" text NOT NULL,
	"provider_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_streaming_snapshot_movie_xor_tv" CHECK (
		("movie_id" IS NOT NULL AND "tv_id" IS NULL)
		OR ("movie_id" IS NULL AND "tv_id" IS NOT NULL)
	)
);

CREATE UNIQUE INDEX "watchlist_streaming_snapshot_user_movie_region_uk"
	ON "watchlist_streaming_snapshot" ("user_id", "movie_id", "region")
	WHERE "movie_id" IS NOT NULL;

CREATE UNIQUE INDEX "watchlist_streaming_snapshot_user_tv_region_uk"
	ON "watchlist_streaming_snapshot" ("user_id", "tv_id", "region")
	WHERE "tv_id" IS NOT NULL;

CREATE INDEX "watchlist_streaming_snapshot_user_checked_idx"
	ON "watchlist_streaming_snapshot" ("user_id", "checked_at" DESC);
