-- Per-title streaming alert request (Attuned) — job alerts when this OR the global pref is on.
ALTER TABLE "watchlist_item" ADD COLUMN IF NOT EXISTS "streaming_alert" boolean DEFAULT false NOT NULL;
