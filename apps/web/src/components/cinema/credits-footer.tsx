import { cn } from "@still/ui/lib/utils";

/**
 * “End credits” crawl — stacked small-caps lines for footers on profile, movie, etc.
 * Intentionally understated so it reads as texture, not a second page of content.
 */
export function CreditsFooter({
  lines,
  className,
}: {
  lines: string[];
  className?: string;
}) {
  if (!lines.length) return null;

  return (
    <footer
      className={cn(
        "border-t border-border/80 pt-10 text-center text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground",
        className,
      )}
    >
      <p className="mb-3 text-[9px] tracking-[0.55em] text-muted-foreground/80">The end</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {lines.map((line) => (
          <li key={line} className="tabular-nums">
            {line}
          </li>
        ))}
      </ul>
    </footer>
  );
}
