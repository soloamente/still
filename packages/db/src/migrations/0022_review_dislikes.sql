-- Review downvotes — `reaction.kind = 'dislike'` + denormalized counter on `review`.
DO $$ BEGIN
 ALTER TYPE "public"."reaction_kind" ADD VALUE 'dislike';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "dislikes_count" integer DEFAULT 0 NOT NULL;