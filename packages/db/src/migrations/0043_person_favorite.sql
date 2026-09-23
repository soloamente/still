-- Patron-saved TMDb cast/crew (separate from diary title Favorites).
CREATE TABLE IF NOT EXISTS "person_favorite" (
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"tmdb_person_id" integer NOT NULL,
	"name" text NOT NULL,
	"profile_url" text,
	"known_for_department" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_favorite_user_person_uk"
	ON "person_favorite" ("user_id", "tmdb_person_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_favorite_user_created_idx"
	ON "person_favorite" ("user_id", "created_at");
--> statement-breakpoint
-- Credits already baseline'd or alerted — avoids re-notify storms after Favorite.
CREATE TABLE IF NOT EXISTS "person_favorite_credit_seen" (
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"tmdb_person_id" integer NOT NULL,
	"media_kind" text NOT NULL,
	"tmdb_id" integer NOT NULL,
	"role_key" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "person_favorite_credit_seen_uk"
	ON "person_favorite_credit_seen" ("user_id", "tmdb_person_id", "media_kind", "tmdb_id", "role_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "person_favorite_credit_seen_user_person_idx"
	ON "person_favorite_credit_seen" ("user_id", "tmdb_person_id");
