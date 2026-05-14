"use client";

import { Button } from "@still/ui/components/button";
import { Textarea } from "@still/ui/components/textarea";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";

type Kind = "review" | "list" | "post" | "log";

type CommentRow = {
  comment: {
    id: string;
    userId: string;
    body: string;
    createdAt: string;
    replyToId: string | null;
  };
  user: { name: string; image: string | null } | null;
  profile: { handle: string; displayName: string } | null;
};

/**
 * Flat comment list with a single composer at the top. Nested replies
 * are supported on the data model but rendered flat here for clarity —
 * we can switch to a tree view later without changing the API.
 */
export function CommentsThread({
  targetKind,
  targetId,
  initialComments,
}: {
  targetKind: Kind;
  targetId: string;
  initialComments: CommentRow[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const res = await api.api.comments.post({
        parentType: targetKind,
        parentId: targetId,
        body: body.trim(),
      });
      const row = res.data as CommentRow["comment"] | null;
      if (row) {
        setComments((c) => [
          {
            comment: row,
            user: null,
            profile: null,
          } satisfies CommentRow,
          ...c,
        ]);
      }
      setBody("");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't post comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          rows={3}
          maxLength={2000}
          placeholder="Share a thought…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="accent" size="pill" disabled={busy || !body.trim()}>
            Post
          </Button>
        </div>
      </form>
      <ul className="space-y-3">
        {comments.map(({ comment, profile, user }) => (
          <li
            key={comment.id}
            className="rounded-2xl border border-border bg-card/60 p-3 text-sm"
          >
            <header className="text-xs text-muted-foreground">
              {profile ? (
                <Link
                  href={`/profile/${profile.handle}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {profile.displayName}
                </Link>
              ) : (
                <span>{user?.name ?? "Someone"}</span>
              )}{" "}
              · {formatDistanceToNowStrict(new Date(comment.createdAt))} ago
            </header>
            <p className="mt-1 whitespace-pre-wrap text-foreground/90">{comment.body}</p>
          </li>
        ))}
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
