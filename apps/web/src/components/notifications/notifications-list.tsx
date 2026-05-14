"use client";

import { Button } from "@still/ui/components/button";
import { Award, Heart, MessageCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { api } from "@/lib/api";
import { formatDistanceToNowStrict } from "@/lib/format";

type Row = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

const KIND_ICON: Record<string, typeof Heart> = {
  reaction: Heart,
  follow: UserPlus,
  comment: MessageCircle,
  badge: Award,
};

const KIND_COPY: Record<string, (p: Record<string, unknown>) => string> = {
  reaction: (p) => `liked your ${p.targetKind ?? "post"}`,
  follow: () => `started following you`,
  comment: () => `commented on your review`,
  badge: (p) => `You earned the "${p.badgeName ?? "badge"}" badge`,
};

export function NotificationsList({ items }: { items: Row[] }) {
  const [rows, setRows] = useState(items);

  async function markAllRead() {
    try {
      await api.api.notifications["read-all"].post();
      setRows(rows.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })));
    } catch {}
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
        The projection booth is quiet — no new stubs yet. We&apos;ll light the marquee when someone
        reacts, follows, or slips a note under your door.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost-light" size="sm" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((row) => {
          const Icon = KIND_ICON[row.kind] ?? Heart;
          const copy = (KIND_COPY[row.kind] ?? (() => "did something"))(row.payload);
          return (
            <li
              key={row.id}
              className={
                row.readAt
                  ? "flex gap-3 rounded-md border border-border bg-card/40 p-3 text-sm"
                  : "flex gap-3 rounded-md border border-desert-orange/30 bg-desert-orange/5 p-3 text-sm"
              }
            >
              <Icon className="mt-0.5 size-4 text-desert-orange" aria-hidden />
              <div className="min-w-0 flex-1">
                <p>{copy}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(row.createdAt))} ago
                </p>
              </div>
              {typeof row.payload.href === "string" ? (
                <Link
                  href={row.payload.href as string}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Open
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
