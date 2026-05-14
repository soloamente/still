import { cn } from "@still/ui/lib/utils";
import Link from "next/link";

/**
 * "Still" wordmark — Inter with a thin dot standing in for the projector lens.
 * Visible aria-label keeps screen readers happy without relying on the SVG mark alone.
 * A single root <Link> avoids invalid nested anchors when the shell wraps the mark.
 */
export function BrandMark({
  size = "md",
  withTagline = false,
  href = "/",
  className,
  "aria-label": ariaLabel = "Still — go to home",
}: {
  size?: "sm" | "md" | "lg";
  withTagline?: boolean;
  /** Logged-in app shell uses `/home`; marketing and auth stay on `/`. */
  href?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const sizeClass = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={cn("group inline-flex items-baseline gap-2 select-none", className)}
    >
      <span
        className={`font-display ${sizeClass} font-medium tracking-[-0.02em] text-pure-white`}
      >
        Still
      </span>
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-desert-orange transition-transform duration-[var(--aker-duration)] group-hover:scale-125"
      />
      {withTagline ? (
        <span className="ml-2 text-xs text-slate-border">your cinematic memory</span>
      ) : null}
    </Link>
  );
}
