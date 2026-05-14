"use client";

import { Button } from "@still/ui/components/button";
import { Check, Link2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

/**
 * Decorative stub + copy link — evokes the diary ticket language without encoding real QR data.
 */
export function MovieShareStub({
  movieId,
  title,
}: {
  movieId: number;
  title: string;
}) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  /** Deterministic “barcode” widths from the numeric id — looks like a stub without parsing. */
  const bars = useMemo(() => {
    const seed = String(movieId).padStart(6, "0");
    return seed.split("").map((ch, idx) => {
      const n = Number(ch) || 1;
      return { key: `${idx}-${ch}`, w: Math.min(5 + n * 2, 14) };
    });
  }, [movieId]);

  async function copy() {
    try {
      const href = `${window.location.origin}${pathname}`;
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be blocked — fail silently like other UI affordances.
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/45 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            Admit one
          </p>
          <p className="mt-2 font-display text-lg tracking-[-0.02em]">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan-style stub is decorative — copy the real link for your group chat.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="select-none"
          onClick={copy}
        >
          {copied ? <Check className="mr-1.5 size-3.5" /> : <Link2 className="mr-1.5 size-3.5" />}
          {copied ? "Copied" : "Copy show link"}
        </Button>
      </div>
      <div
        aria-hidden
        className="mt-4 flex h-12 items-end gap-0.5 rounded-md border border-border bg-absolute-black/40 px-2 py-1"
      >
        {bars.map((b) => (
          <span
            key={b.key}
            className="rounded-[1px] bg-pure-white/80"
            style={{ width: `${b.w}px`, height: "80%" }}
          />
        ))}
      </div>
      <p className="mt-2 tabular-nums text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Still · {movieId.toString().padStart(7, "0")}
      </p>
    </div>
  );
}
