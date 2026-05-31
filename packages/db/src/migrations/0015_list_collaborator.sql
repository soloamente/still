-- SN.15 — collaborative lists: explicit editors per list (replaces open `is_collaborative` edit hole).
CREATE TABLE IF NOT EXISTS "list_collaborator" (
	"list_id" text NOT NULL REFERENCES "list"("id") ON DELETE CASCADE,
	"user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"invited_by_id" text REFERENCES "user"("id") ON DELETE SET NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "list_collaborator_list_user_uk" ON "list_collaborator" ("list_id", "user_id");
CREATE INDEX IF NOT EXISTS "list_collaborator_user_idx" ON "list_collaborator" ("user_id");
