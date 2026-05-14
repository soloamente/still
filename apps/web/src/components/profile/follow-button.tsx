"use client";

import { Button } from "@still/ui/components/button";
import { Loader2, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

/**
 * Follow/unfollow toggle. State starts unknown and is hydrated from
 * /follows/:targetUserId so navigating to a profile shows the right
 * state without server work in the parent.
 */
export function FollowButton({ targetUserId }: { targetUserId: string }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.api.follows
      .check({ userId: targetUserId })
      .get()
      .then((res) => {
        if (cancelled) return;
        const data = res.data as { following?: boolean } | null;
        setFollowing(Boolean(data?.following));
      })
      .catch(() => {
        if (!cancelled) setFollowing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  async function toggle() {
    setBusy(true);
    try {
      if (following) {
        await api.api.follows({ userId: targetUserId }).delete();
        setFollowing(false);
        toast.success("Unfollowed");
      } else {
        await api.api.follows({ userId: targetUserId }).post();
        setFollowing(true);
        toast.success("Following");
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update");
    } finally {
      setBusy(false);
    }
  }

  if (following === null) {
    return (
      <Button variant="ghost-light" size="pill" disabled>
        <Loader2 className="size-3.5 animate-spin" /> Loading
      </Button>
    );
  }

  return (
    <Button
      variant={following ? "ghost-light" : "accent"}
      size="pill"
      onClick={toggle}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : following ? (
        <UserCheck className="size-3.5" />
      ) : (
        <UserPlus className="size-3.5" />
      )}
      {following ? "Following" : "Follow"}
    </Button>
  );
}
