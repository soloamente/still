"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/api";

type Kind = "review" | "list" | "post";

/**
 * Like button + counter. Liked state is hydrated lazily on click —
 * keeping initial render fast and avoiding the per-row JS dependency.
 * Each parent type has its own `/like` endpoint to keep counters consistent.
 */
export function ReactionsBar({
  targetKind,
  targetId,
  initialLikes,
  initialLiked = false,
}: {
  targetKind: Kind;
  targetId: string;
  initialLikes: number;
  initialLiked?: boolean;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const route =
        targetKind === "review"
          ? api.api.reviews({ id: targetId }).like
          : targetKind === "list"
            ? api.api.lists({ id: targetId }).like
            : api.api.posts({ id: targetId }).like;
      const res = await route.post({});
      const data = res.data as { liked?: boolean } | null;
      const nowLiked = Boolean(data?.liked);
      setLiked(nowLiked);
      setLikes((n) => Math.max(0, n + (nowLiked ? 1 : -1)));
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-1 text-sm transition-colors hover:text-desert-orange"
    >
      <Heart
        className={
          liked ? "size-3.5 fill-desert-orange text-desert-orange" : "size-3.5 text-current"
        }
      />
      {likes}
    </button>
  );
}
