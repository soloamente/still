import type { ReactNode } from "react";

import { cn } from "@still/ui/lib/utils";

/**
 * Widescreen frame primitive — fixed aspect ratio (Scope / Flat / 21:9) with
 * optional true-black letterbox bars top + bottom so heroes read as projected
 * frames, not full-bleed banners. All layout is CSS (`aspect-ratio`); no JS
 * resize listeners. Decorative chrome keeps `pointer-events` off where needed
 * by leaving children responsible for interactivity.
 */

const ASPECT_RATIO: Record<"2.39" | "2.35" | "1.85" | "21:9", string> = {
  /** Cinemascope ~2.39:1 */
  "2.39": "2.39 / 1",
  /** Classic widescreen ~2.35:1 */
  "2.35": "2.35 / 1",
  /** Flat / American widescreen ~1.85:1 */
  "1.85": "1.85 / 1",
  /** Ultrawide “laser” strip (profile covers, some marquees) */
  "21:9": "21 / 9",
};

export function Letterbox({
  aspect = "2.39",
  bars = true,
  /** When `bars` is true: `both` = top + bottom mattes; `bottom` = only under the frame (top flush — e.g. movie hero without a black band under the nav column). */
  barPlacement = "both",
  children,
  className,
}: {
  /** Target projection ratio — drives `aspect-ratio` on the inner frame. */
  aspect?: keyof typeof ASPECT_RATIO;
  /**
   * When true, pads the frame with true black (`--color-absolute-black`) top +
   * bottom: 10px on small screens, 16px from `md` up (classic letterbox bars).
   */
  bars?: boolean;
  barPlacement?: "both" | "bottom";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full",
        /* True-black bars — slightly richer than the theater-floor body BG */
        bars &&
          cn(
            "bg-absolute-black",
            barPlacement === "bottom" ? "pb-2.5 md:pb-4" : "py-2.5 md:py-4",
          ),
        className,
      )}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: ASPECT_RATIO[aspect] }}
      >
        {children}
      </div>
    </div>
  );
}
