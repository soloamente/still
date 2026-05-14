"use client";

import { cn } from "@still/ui/lib/utils";
import { Star } from "lucide-react";
import { useState } from "react";

/**
 * Letterboxd-style 10-step half-star rating.
 *
 * Values are stored in 1..10 (so 4.5★ = 9). Pass `readOnly` to render a
 * display-only widget. When interactive, hovering shows the candidate
 * value; clicking commits it (or clears if clicked again).
 */
export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = "md",
  /** “Marquee bulbs” adds a soft glow on filled stars — great for hero stats. */
  variant = "default",
  className,
}: {
  value: number | null;
  onChange?: (next: number | null) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "marquee";
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;

  const px = { sm: "size-3", md: "size-4", lg: "size-6" }[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 tabular",
        readOnly ? "pointer-events-none" : "cursor-pointer",
        className,
      )}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={value ? `Rated ${value / 2} out of 5` : "Not rated"}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: 5 }).map((_, i) => {
        const fullIndex = (i + 1) * 2;
        const halfIndex = i * 2 + 1;
        const halfFilled = display >= halfIndex;
        const fullFilled = display >= fullIndex;
        return (
          <span key={i} className="relative inline-flex">
            <Star
              className={cn(
                px,
                "text-muted-foreground/40 transition-colors duration-[var(--aker-duration-fast)]",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 overflow-hidden",
                fullFilled ? "w-full" : halfFilled ? "w-1/2" : "w-0",
              )}
            >
              <Star
                className={cn(
                  px,
                  "fill-desert-orange text-desert-orange",
                  variant === "marquee" && "star-marquee-bulb",
                )}
                aria-hidden
              />
            </span>
            {!readOnly ? (
              <>
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 z-10 w-1/2"
                  aria-label={`Set rating to ${halfIndex / 2}`}
                  onMouseEnter={() => setHover(halfIndex)}
                  onClick={() => onChange?.(value === halfIndex ? null : halfIndex)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 w-1/2"
                  aria-label={`Set rating to ${fullIndex / 2}`}
                  onMouseEnter={() => setHover(fullIndex)}
                  onClick={() => onChange?.(value === fullIndex ? null : fullIndex)}
                />
              </>
            ) : null}
          </span>
        );
      })}
      {value ? (
        <span className="ml-1 text-xs text-muted-foreground">{(value / 2).toFixed(1)}</span>
      ) : null}
    </div>
  );
}
