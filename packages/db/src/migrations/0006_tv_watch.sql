CREATE TABLE "tv_watch" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tv_id" integer NOT NULL,
	"status" text DEFAULT 'watching' NOT NULL,
	"progress_mode" text DEFAULT 'season' NOT NULL,
	"last_season" smallint,
	"last_episode" smallint,
	"notify_new_episodes" boolean DEFAULT true NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"status_changed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_watch_episode" (
	"tv_watch_id" text NOT NULL,
	"season_number" smallint NOT NULL,
	"episode_number" smallint NOT NULL,
	"watched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN "log_scope" text DEFAULT 'show' NOT NULL;--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN "season_number" smallint;--> statement-breakpoint
ALTER TABLE "log" ADD COLUMN "episode_number" smallint;--> statement-breakpoint
ALTER TABLE "tv_watch" ADD CONSTRAINT "tv_watch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_watch" ADD CONSTRAINT "tv_watch_tv_id_tv_tmdb_id_fk" FOREIGN KEY ("tv_id") REFERENCES "public"."tv"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_watch_episode" ADD CONSTRAINT "tv_watch_episode_tv_watch_id_tv_watch_id_fk" FOREIGN KEY ("tv_watch_id") REFERENCES "public"."tv_watch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tv_watch_user_tv_uk" ON "tv_watch" USING btree ("user_id","tv_id");--> statement-breakpoint
CREATE INDEX "tv_watch_user_status_idx" ON "tv_watch" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tv_watch_episode_uk" ON "tv_watch_episode" USING btree ("tv_watch_id","season_number","episode_number");
