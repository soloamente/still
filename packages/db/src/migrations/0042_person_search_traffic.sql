-- Sense search-dialog traffic per TMDb person (cast/crew rank overlay).
CREATE TABLE IF NOT EXISTS "person_search_traffic" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"profile_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_search_traffic_hits_idx"
	ON "person_search_traffic" ("hit_count");
