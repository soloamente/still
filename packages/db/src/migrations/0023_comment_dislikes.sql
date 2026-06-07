-- Comment downvotes — `reaction.kind = 'dislike'` on `parent_type = 'comment'`.
ALTER TABLE "comment" ADD COLUMN IF NOT EXISTS "dislikes_count" integer DEFAULT 0 NOT NULL;
