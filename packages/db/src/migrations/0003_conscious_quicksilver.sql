CREATE TABLE "tv" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"first_air_date" timestamp,
	"overview" text,
	"poster_path" text,
	"backdrop_path" text,
	"genre_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"original_language" text,
	"popularity" double precision,
	"vote_average" double precision,
	"vote_count" integer,
	"status" text,
	"tmdb_json" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "watchlist_user_movie_uk";--> statement-breakpoint
ALTER TABLE "log" ALTER COLUMN "movie_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_item" ALTER COLUMN "movie_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN "tv_id" integer;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD COLUMN "tv_id" integer;--> statement-breakpoint
CREATE INDEX "tv_title_idx" ON "tv" USING btree ("title");--> statement-breakpoint
CREATE INDEX "tv_year_idx" ON "tv" USING btree ("year");--> statement-breakpoint
ALTER TABLE "log" ADD CONSTRAINT "log_tv_id_tv_tmdb_id_fk" FOREIGN KEY ("tv_id") REFERENCES "public"."tv"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_tv_id_tv_tmdb_id_fk" FOREIGN KEY ("tv_id") REFERENCES "public"."tv"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_tv_idx" ON "log" USING btree ("tv_id");--> statement-breakpoint
CREATE INDEX "log_user_tv_idx" ON "log" USING btree ("user_id","tv_id");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_tv_uk" ON "watchlist_item" USING btree ("user_id","tv_id") WHERE "watchlist_item"."tv_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_movie_uk" ON "watchlist_item" USING btree ("user_id","movie_id") WHERE "watchlist_item"."movie_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "log" ADD CONSTRAINT "log_movie_xor_tv" CHECK (("log"."movie_id" IS NOT NULL AND "log"."tv_id" IS NULL) OR ("log"."movie_id" IS NULL AND "log"."tv_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_movie_xor_tv" CHECK (("watchlist_item"."movie_id" IS NOT NULL AND "watchlist_item"."tv_id" IS NULL) OR ("watchlist_item"."movie_id" IS NULL AND "watchlist_item"."tv_id" IS NOT NULL));