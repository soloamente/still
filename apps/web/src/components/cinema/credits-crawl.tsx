"use client";

import { cn } from "@still/ui/lib/utils";
import { useEffect, useId, useState, type CSSProperties } from "react";

/** One crawl block — role label (JOB / DEPARTMENT) plus person lines beneath. */
export interface CreditsCrawlLine {
  role: string;
  /** Display names shown under the role; keep each row short-ish for readability. */
  people: string[];
}

/**
 * Slow vertical crawl for “closing credits” moments (crew blocks, wrap lines).
 *
 * Hover or keyboard focus pauses motion so readers can skim. Duplicate content
 * + translateY loops seamlessly. When `prefers-reduced-motion` is enabled,
 * resolves to a static, scrollable column (respects accessibility policy).
 */
export function CreditsCrawl({
  lines,
  durationSec = 120,
  className,
}: {
  lines: CreditsCrawlLine[];
  /** Seconds for half the marquee (matches duplicated track height via -50%). */
  durationSec?: number;
  className?: string;
}) {
  const blockId = useId();
  const [mounted, setMounted] = useState(false);
  /** After mount only — avoids SSR/CSS mismatch vs `matchMedia`; first paint stays static-ish. */
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionOk(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const visibleLines = lines.filter((l) => l.people.some((p) => p.trim().length > 0));
  if (!visibleLines.length) return null;

  const style = {
    "--credits-duration": `${durationSec}s`,
  } as CSSProperties;

  const crawlBlocks = visibleLines.map((line) => (
    <div key={`${blockId}:${line.role}`} className="mb-14 text-center last:mb-0">
      <p className="font-display mb-5 text-[12px] font-medium uppercase tracking-[0.42em] text-desert-orange/90 md:text-[11px]">
        {line.role}
      </p>
      <ul className="space-y-3 text-[13px] leading-snug tracking-wide text-muted-foreground md:text-sm">
        {line.people.filter(Boolean).map((person, i) => (
          <li key={`${person}-${i}`}>{person}</li>
        ))}
      </ul>
    </div>
  ));

  const useScroll = mounted && motionOk;

  return (
    <div
      className={cn(
        "cinema-credits-crawl-surface focus-within:border-desert-orange/35 relative rounded-2xl border border-border/80 bg-card/45 outline-none backdrop-blur-sm",
        // Static column: constrain height so long lists scroll instead of towering the page.
        !useScroll &&
          "max-h-[min(22rem,calc(100vh-8rem))] overflow-y-auto [scrollbar-width:thin] py-10",
        useScroll &&
          "[mask-image:linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)] h-[min(22rem,calc(100vh-9rem))] overflow-hidden pt-12 pb-10",
        className,
      )}
      style={style}
      tabIndex={0}
      role="region"
      aria-label="Scrolling credits — hover or focus to pause"
    >
      {/* Decorative film edge so the block registers as theater chrome, not a generic list. */}
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {!useScroll ? (
        <div className="px-6">{crawlBlocks}</div>
      ) : (
        <div className="relative h-full">
          {/* Track duplicates content for seamless loop; animation defined in globals.css. */}
          <div className="cinema-credits-crawl-track will-change-transform px-10">
            <div>{crawlBlocks}</div>
            <div className="cinema-credits-crawl-ghost" aria-hidden>
              {crawlBlocks}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
