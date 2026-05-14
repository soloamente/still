CREATE TYPE "public"."chat_member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."chat_thread_kind" AS ENUM('dm', 'group');--> statement-breakpoint
CREATE TYPE "public"."badge_tier" AS ENUM('bronze', 'silver', 'gold', 'platinum', 'legendary');--> statement-breakpoint
CREATE TYPE "public"."post_kind" AS ENUM('status', 'share', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."reaction_kind" AS ENUM('like', 'love', 'spotlight', 'fire', 'mind_blown', 'laugh');--> statement-breakpoint
CREATE TYPE "public"."reaction_parent_type" AS ENUM('review', 'post', 'list', 'comment', 'log');--> statement-breakpoint
CREATE TYPE "public"."news_source_kind" AS ENUM('tmdb_trending', 'tmdb_upcoming', 'tmdb_now_playing', 'tmdb_popular', 'rss');--> statement-breakpoint
CREATE TABLE "log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"movie_id" integer NOT NULL,
	"watched_at" timestamp NOT NULL,
	"rating" smallint,
	"liked" boolean DEFAULT false NOT NULL,
	"rewatch" boolean DEFAULT false NOT NULL,
	"note" text,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"movie_id" integer NOT NULL,
	"log_id" text,
	"title" text,
	"body" text NOT NULL,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"rating" smallint,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_item" (
	"user_id" text NOT NULL,
	"movie_id" integer NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"remind_at" timestamp,
	"priority" smallint DEFAULT 50 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_member" (
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "chat_member_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_read_at" timestamp,
	"is_muted" timestamp,
	"left_at" timestamp,
	CONSTRAINT "chat_member_thread_id_user_id_pk" PRIMARY KEY("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reply_to_id" text,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "chat_thread_kind" DEFAULT 'dm' NOT NULL,
	"title" text,
	"image_url" text,
	"created_by_id" text,
	"last_message_at" timestamp,
	"last_message_preview" text,
	"last_message_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievement" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon_url" text,
	"points" integer DEFAULT 25 NOT NULL,
	"is_hidden" boolean DEFAULT true NOT NULL,
	"target" integer,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "achievement_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "badge" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon_url" text,
	"tier" "badge_tier" DEFAULT 'bronze' NOT NULL,
	"category" text,
	"points" integer DEFAULT 10 NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"criteria" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "badge_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_achievement" (
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unlocked_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievement_user_id_achievement_id_pk" PRIMARY KEY("user_id","achievement_id")
);
--> statement-breakpoint
CREATE TABLE "user_badge" (
	"user_id" text NOT NULL,
	"badge_id" text NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL,
	"earned_context" jsonb,
	"is_pinned" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_badge_user_id_badge_id_pk" PRIMARY KEY("user_id","badge_id")
);
--> statement-breakpoint
CREATE TABLE "block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reason" text,
	CONSTRAINT "block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "follow" (
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"is_mutual" boolean DEFAULT false NOT NULL,
	CONSTRAINT "follow_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"pronouns" text,
	"location" text,
	"website" text,
	"banner_url" text,
	"accent_color" text,
	"favorite_movie_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"section_order" jsonb DEFAULT '["about","favorite_films","recently_watched","recent_reviews","lists","achievements"]'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats_cache" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_pro" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "movie" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"imdb_id" text,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"release_date" timestamp,
	"runtime" integer,
	"overview" text,
	"tagline" text,
	"poster_path" text,
	"backdrop_path" text,
	"genre_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"original_language" text,
	"spoken_languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"popularity" double precision,
	"vote_average" double precision,
	"vote_count" integer,
	"adult" boolean DEFAULT false NOT NULL,
	"status" text,
	"tmdb_json" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movie_credit" (
	"movie_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"credit_id" text NOT NULL,
	"department" text NOT NULL,
	"job" text,
	"character" text,
	"order" integer,
	CONSTRAINT "movie_credit_movie_id_credit_id_pk" PRIMARY KEY("movie_id","credit_id")
);
--> statement-breakpoint
CREATE TABLE "person" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile_path" text,
	"known_for_department" text,
	"birthday" timestamp,
	"deathday" timestamp,
	"biography" text,
	"popularity" double precision,
	"tmdb_json" jsonb,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"description" text,
	"is_ranked" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"is_collaborative" boolean DEFAULT false NOT NULL,
	"cover_movie_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"items_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_item" (
	"list_id" text NOT NULL,
	"movie_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"note" text,
	"added_by_id" text,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "list_item_list_id_movie_id_pk" PRIMARY KEY("list_id","movie_id")
);
--> statement-breakpoint
CREATE TABLE "comment" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_type" "reaction_parent_type" NOT NULL,
	"parent_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"reply_to_id" text,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"edited_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "post_kind" DEFAULT 'status' NOT NULL,
	"body" text NOT NULL,
	"ref_type" text,
	"ref_id" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reaction" (
	"user_id" text NOT NULL,
	"parent_type" "reaction_parent_type" NOT NULL,
	"parent_id" text NOT NULL,
	"kind" "reaction_kind" DEFAULT 'like' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reaction_user_id_parent_type_parent_id_kind_pk" PRIMARY KEY("user_id","parent_type","parent_id","kind")
);
--> statement-breakpoint
CREATE TABLE "news_article" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text,
	"url" text NOT NULL,
	"image_url" text,
	"author" text,
	"published_at" timestamp NOT NULL,
	"movie_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"person_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_source" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" "news_source_kind" NOT NULL,
	"url" text,
	"icon_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "log" ADD CONSTRAINT "log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log" ADD CONSTRAINT "log_movie_id_movie_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_movie_id_movie_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_log_id_log_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."log"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_item" ADD CONSTRAINT "watchlist_item_movie_id_movie_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_member" ADD CONSTRAINT "chat_member_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_member" ADD CONSTRAINT "chat_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_thread_id_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD CONSTRAINT "chat_thread_last_message_by_id_user_id_fk" FOREIGN KEY ("last_message_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_log" ADD CONSTRAINT "event_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_achievement_id_achievement_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievement"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badge" ADD CONSTRAINT "user_badge_badge_id_badge_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."badge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follow" ADD CONSTRAINT "follow_following_id_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_credit" ADD CONSTRAINT "movie_credit_movie_id_movie_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("tmdb_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_credit" ADD CONSTRAINT "movie_credit_person_id_person_tmdb_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("tmdb_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list" ADD CONSTRAINT "list_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_list_id_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_movie_id_movie_tmdb_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movie"("tmdb_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_item" ADD CONSTRAINT "list_item_added_by_id_user_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reaction" ADD CONSTRAINT "reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_source_id_news_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."news_source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_user_watched_idx" ON "log" USING btree ("user_id","watched_at");--> statement-breakpoint
CREATE INDEX "log_movie_idx" ON "log" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "log_user_movie_idx" ON "log" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "log_rating_idx" ON "log" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "review_user_idx" ON "review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "review_movie_idx" ON "review" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "review_published_idx" ON "review" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "review_likes_idx" ON "review" USING btree ("likes_count");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlist_user_movie_uk" ON "watchlist_item" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "watchlist_user_added_idx" ON "watchlist_item" USING btree ("user_id","added_at");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "chat_member_user_idx" ON "chat_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_thread_created_idx" ON "chat_message" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_message_user_idx" ON "chat_message" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_reply_idx" ON "chat_message" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "chat_thread_last_msg_idx" ON "chat_thread" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "achievement_hidden_idx" ON "achievement" USING btree ("is_hidden");--> statement-breakpoint
CREATE INDEX "badge_category_idx" ON "badge" USING btree ("category");--> statement-breakpoint
CREATE INDEX "event_log_unprocessed_idx" ON "event_log" USING btree ("processed_at","created_at");--> statement-breakpoint
CREATE INDEX "event_log_user_kind_idx" ON "event_log" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "event_log_id_uk" ON "event_log" USING btree ("id");--> statement-breakpoint
CREATE INDEX "user_achievement_unlocked_idx" ON "user_achievement" USING btree ("unlocked_at");--> statement-breakpoint
CREATE INDEX "user_badge_user_pinned_idx" ON "user_badge" USING btree ("user_id","is_pinned");--> statement-breakpoint
CREATE INDEX "block_blocked_idx" ON "block" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "follow_following_idx" ON "follow" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "follow_follower_idx" ON "follow" USING btree ("follower_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_handle_lower_idx" ON "profile" USING btree ("handle");--> statement-breakpoint
CREATE INDEX "profile_display_name_idx" ON "profile" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "movie_title_idx" ON "movie" USING btree ("title");--> statement-breakpoint
CREATE INDEX "movie_year_idx" ON "movie" USING btree ("year");--> statement-breakpoint
CREATE INDEX "movie_popularity_idx" ON "movie" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "movie_release_date_idx" ON "movie" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "movie_credit_person_idx" ON "movie_credit" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "movie_credit_movie_idx" ON "movie_credit" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "movie_credit_department_idx" ON "movie_credit" USING btree ("department");--> statement-breakpoint
CREATE INDEX "person_name_idx" ON "person" USING btree ("name");--> statement-breakpoint
CREATE INDEX "person_popularity_idx" ON "person" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "list_user_idx" ON "list" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "list_public_updated_idx" ON "list" USING btree ("is_public","updated_at");--> statement-breakpoint
CREATE INDEX "list_likes_idx" ON "list" USING btree ("likes_count");--> statement-breakpoint
CREATE INDEX "list_item_position_idx" ON "list_item" USING btree ("list_id","position");--> statement-breakpoint
CREATE INDEX "list_item_movie_idx" ON "list_item" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "comment_parent_idx" ON "comment" USING btree ("parent_type","parent_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_user_idx" ON "comment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comment_reply_to_idx" ON "comment" USING btree ("reply_to_id");--> statement-breakpoint
CREATE INDEX "post_user_idx" ON "post" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "post_published_idx" ON "post" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "post_ref_idx" ON "post" USING btree ("ref_type","ref_id");--> statement-breakpoint
CREATE INDEX "reaction_target_idx" ON "reaction" USING btree ("parent_type","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_article_source_external_uk" ON "news_article" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "news_article_published_idx" ON "news_article" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_article_source_published_idx" ON "news_article" USING btree ("source_id","published_at");--> statement-breakpoint
CREATE INDEX "news_source_kind_idx" ON "news_source" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("user_id","read_at");