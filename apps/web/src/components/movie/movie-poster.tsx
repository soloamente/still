import { cn } from "@still/ui/lib/utils";
import { Film } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

/**
 * Poster card — 2∶3 aspect with TMDb `sizes` hints.
 * `size="md"` (default) fills grid tracks so ultra-wide layouts grow artwork instead of thin 128 px strips.
 * Wraps in `<Link>` for accessibility / right-click open.
 */
export function MoviePoster({
  movieId,
  title,
  posterUrl,
  size = "md",
  showTitle = false,
  /** Adds a subtle inner bezel so the poster reads like a framed print. */
  filmFrame = false,
  className,
  priority = false,
}: {
  movieId: number;
  title: string;
  posterUrl: string | null;
  /** `hero` = full width of parent on small screens (detail page), larger fixed widths from `md` up. */
  size?: "xs" | "sm" | "md" | "lg" | "hero";
  showTitle?: boolean;
  filmFrame?: boolean;
  className?: string;
  priority?: boolean;
}) {
  /** Default `md` stretches with grid tracks so ultra-wide shells don’t strand tiny thumbnails. */
  const dim =
    size === "hero"
      ? "w-full shrink-0 md:w-72 lg:w-80 xl:w-[22rem] 2xl:w-[24rem]"
      : {
          xs: "w-14",
          sm: "w-24 shrink-0 sm:w-[6.875rem]",
          md: "w-full",
          lg: "w-full max-w-[16rem]",
        }[size];

  /** Detail hero: flush left on phones (full band width), framed from `md` up. */
  const heroFrame =
    size === "hero"
      ? "rounded-none md:rounded-md max-md:border-x-0 max-md:rounded-none"
      : "";

  const imageSizes =
    size === "hero"
      ? "(max-width: 768px) 100vw, (max-width: 1536px) 360px, 420px"
      : "(max-width: 640px) 38vw, (max-width: 1024px) 28vw, (max-width: 1536px) 220px, 260px";

  return (
    <Link
      href={`/movies/${movieId}`}
      className={cn("group block", className)}
      aria-label={title}
    >
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-card",
          "transition-transform duration-[var(--aker-duration)] ease-[var(--aker-ease)]",
          "group-hover:-translate-y-1 group-hover:border-desert-orange/40",
          filmFrame &&
            "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.5)] ring-1 ring-pure-white/12 ring-inset",
          heroFrame,
          dim,
        )}
      >
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes={imageSizes}
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            <Film className="size-6" aria-hidden />
          </div>
        )}
      </div>
      {showTitle ? (
        <p className="mt-2 line-clamp-2 text-[0.8rem] leading-snug text-muted-foreground sm:text-sm group-hover:text-foreground">
          {title}
        </p>
      ) : null}
    </Link>
  );
}
