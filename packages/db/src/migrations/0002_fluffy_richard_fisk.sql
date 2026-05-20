ALTER TABLE "log" ADD COLUMN "watch_venue" text DEFAULT 'streaming' NOT NULL;--> statement-breakpoint
CREATE INDEX "log_user_venue_idx" ON "log" USING btree ("user_id","watch_venue");