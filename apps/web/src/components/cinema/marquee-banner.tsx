"use client";

import { cn } from "@still/ui/lib/utils";

/** Lines that scroll like a classic venue marquee — duplicated once for the CSS loop. */
const MARQUEE_CYCLE = [
  "Now showing on Still",
  "House lights dim",
  "Your circle · real showtimes",
  "Pass the popcorn",
  "Stay for the credits",
] as const;

/**
 * Full-bleed ticker under the top nav. Pure CSS motion (`cinema-marquee-track`);
 * respects `prefers-reduced-motion` globally in `globals.css`.
 */
export function MarqueeBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "-mx-4 mb-10 rounded-none border-0 bg-transparent px-0 py-2.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground shadow-none outline-none ring-0 sm:-mx-6 lg:-mx-8 xl:-mx-12 2xl:-mx-16",
        className,
      )}
      aria-hidden
    >
      {/* Clip only the translating track — avoids page-level horizontal spill. */}
      <div className="min-w-0 overflow-hidden rounded-none border-0 shadow-none ring-0">
      <div className="cinema-marquee-track">
        {[0, 1].map((pass) => (
          <span
            key={pass}
            className="flex shrink-0 items-center gap-[var(--cinema-marquee-phrase-gap)]"
          >
            {MARQUEE_CYCLE.map((line) => (
              <span key={`${pass}-${line}`} className="whitespace-nowrap text-foreground/80">
                {line}
              </span>
            ))}
          </span>
        ))}
      </div>
      </div>
    </div>
  );
}
