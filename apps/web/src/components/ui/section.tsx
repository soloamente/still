import { cn } from "@still/ui/lib/utils";
import type { ReactNode } from "react";

/**
 * A common header + content shell used across feed, movie, profile.
 * Heading uses `font-display` (Fraunces) so every page-section title reads
 * cinematic; subtitle stays Inter at body size.
 */
export function Section({
  /** Tiny all-caps runway line above the title — used for cinema-themed pages. */
  kicker,
  title,
  subtitle,
  rightSlot,
  children,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <header className="flex items-end justify-between gap-3">
        <div>
          {kicker ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-desert-orange">
              {kicker}
            </p>
          ) : null}
          <h2 className="font-display text-2xl font-medium tracking-[-0.02em] sm:text-[1.65rem] md:text-3xl lg:text-[2.0625rem]">
            {title}
          </h2>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {rightSlot}
      </header>
      {children}
    </section>
  );
}
