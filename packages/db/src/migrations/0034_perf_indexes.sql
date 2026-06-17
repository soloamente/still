-- Performance indexes: block.blocker_id, tv.popularity, tv_watch.tv_id, review.log_id, watchlist_item.movie_id/tv_id, list(user_id, is_public)
CREATE INDEX IF NOT EXISTS "block_blocker_idx" ON "block" ("blocker_id");
CREATE INDEX IF NOT EXISTS "tv_popularity_idx" ON "tv" ("popularity");
CREATE INDEX IF NOT EXISTS "tv_watch_tv_idx" ON "tv_watch" ("tv_id");
CREATE INDEX IF NOT EXISTS "review_log_idx" ON "review" ("log_id");
CREATE INDEX IF NOT EXISTS "watchlist_movie_idx" ON "watchlist_item" ("movie_id");
CREATE INDEX IF NOT EXISTS "watchlist_tv_idx" ON "watchlist_item" ("tv_id");
CREATE INDEX IF NOT EXISTS "list_user_public_idx" ON "list" ("user_id", "is_public");
