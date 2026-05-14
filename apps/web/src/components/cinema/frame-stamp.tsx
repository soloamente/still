import { cn } from "@still/ui/lib/utils";

export interface FrameStampProps {
  /** Decorative gate / reel copy (keep short so it hugs the bezel). */
  label: string;
  className?: string;
}

/**
 * Subtle photochemical bezel label — evokes stock metadata without reading as nav.
 */
export function FrameStamp({ label, className }: FrameStampProps) {
  return (
    <p
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-3 left-3 z-[2] max-w-[min(94%,22rem)] select-none font-mono text-[9px] font-normal uppercase leading-snug tracking-[0.3em] text-pretty whitespace-normal text-foreground/40 md:top-4 md:left-4 md:text-[10px]",
        className,
      )}
    >
      {label}
    </p>
  );
}
