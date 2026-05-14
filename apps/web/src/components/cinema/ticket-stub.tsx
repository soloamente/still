import { cn } from "@still/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Tailwind width for `posterFillTicket` compact rail `<li>` — keep equal to compact `fullBleedWidth`.
 * Exported so Coming-soon scroller gutters stay keyed to stub geometry without magic numbers drifting.
 */
export const TICK_COMPACT_FILL_RAIL_TW = "w-[188px]" as const;

/** Layout preset drives rounding, perforations, TMDB widths, typography scale. */
const SIZE_PRESETS = {
  /** Diary + watchlist parity — roomy title block. */
  default: {
    maxWidth: "max-w-[280px]",
    roundedTop: "rounded-t-[22px]",
    roundedBottom: "rounded-b-[22px]",
    notch: "size-[22px]",
    tmDbWidth: "w500",
    posterSizes: "(max-width:640px) 92vw, 280px",
    shadow: "shadow-[0_14px_36px_rgba(0,0,0,0.42)]",
    /** Fixed width for rails when the poster spans the entire ticket silhouette. */
    fullBleedWidth: "w-[280px]",
  },
  /** Horizontal rails — narrower ticket for density without losing silhouette. */
  compact: {
    maxWidth: "max-w-[188px]",
    roundedTop: "rounded-t-[14px]",
    roundedBottom: "rounded-b-[14px]",
    /** Narrow horizontal rail — small punches so Ø doesn’t overwhelm a ~188 px spine */
    notch: "size-[20px]",
    tmDbWidth: "w500",
    posterSizes: "188px",
    shadow: "shadow-[0_8px_24px_rgba(0,0,0,0.38)]",
    fullBleedWidth: TICK_COMPACT_FILL_RAIL_TW,
  },
} as const;

export type TicketStubSize = keyof typeof SIZE_PRESETS;

export interface TicketStubProps {
  href?: string;
  ariaLabel?: string;
  /** TMDB-backed path fragment (poster path) OR full HTTPS URL (`poster_url` from API). */
  posterUrl: string | null;
  posterAlt?: string;
  stubBackground?: string;
  size?: TicketStubSize;
  showNotches?: boolean;
  /** Fine print tucked above the perforated rule (inside stub ink). */
  stubKicker?: ReactNode;
  children: ReactNode;
  className?: string;
  posterClassName?: string;
  /**
   * Watchlist/stack layouts animate the outer `<li>`; disable Diary-style zoom on the `<Link>`
   * so `:has`-driven choreography is the only motion source.
   */
  linkHoverGrow?: boolean;
  /**
   * Home-style rail stub: one poster field + optional side punch holes (`showNotches`).
   * Keeps the dashed tear line off (per product request) but restores the stock silhouette.
   */
  posterFillTicket?: boolean;
  /**
   * With `posterFillTicket`, default width is rail-fixed (`fullBleedWidth`). Set true so the stub
   * stretches to its parent grid/flex column (e.g. home “Popular” cells) instead of pinning 188/280 px.
   * **`compact` + poster-fill**: larger punched holes than the Coming-soon rail—grid posters are taller/wider so big holes scale better.
   */
  posterFillFlexible?: boolean;
}

function resolvePosterSrc(posterUrl: string | null, tmDbWidth: string): string | null {
  if (!posterUrl?.length) return null;
  if (posterUrl.startsWith("http")) return posterUrl;
  const fragment = posterUrl.startsWith("/") ? posterUrl : `/${posterUrl}`;
  return `https://image.tmdb.org/t/p/${tmDbWidth}${fragment}`;
}

/**
 * Poster-first admission stub — perforated seam, cardstock pigment, dashed tear line.
 *
 * Diary, watchlists, “coming attraction” carousel all share this silhouette while the
 * `children` region carries typography / icons specific to each context.
 *
 * Passing `href` wraps the ticket in `<Link>` with cinematic hover scale consistent with Diary.
 *
 * Note: **`posterFillTicket`** uses one poster plane; side notches + an optional hover/focus bottom scrim aid legibility together with halo text.
 * Use **`posterFillFlexible`** for fluid grid columns alongside fixed-width rails (`w-full`, `min-w-0`).
 */
export function TicketStub({
  href,
  ariaLabel,
  posterUrl,
  posterAlt = "",
  stubBackground = "#821c2e",
  size = "default",
  showNotches = true,
  stubKicker,
  children,
  className,
  posterClassName,
  linkHoverGrow = true,
  posterFillTicket = false,
  posterFillFlexible = false,
}: TicketStubProps) {
  const preset = SIZE_PRESETS[size];
  const resolved = resolvePosterSrc(posterUrl, preset.tmDbWidth);

  /** Popular fills multi-column grids—big posters need bold punches; Coming-soon fixed rail uses the preset’s smaller Ø */
  const compactPosterFillFlexible = size === "compact" && posterFillTicket && posterFillFlexible;

  /** Grid Popular: Ø38 punches; Coming-soon / other compact rails: preset (smaller notch). */
  const posterFillNotchClass = compactPosterFillFlexible ? "size-[38px]" : preset.notch;

  /** Band height keyed to notch diameter — large flexible grid punches need the tall strip. */
  const posterFillNotchBandClass =
    size === "compact"
      ? compactPosterFillFlexible
        ? "top-[calc(68%-14px)] h-10"
        : "top-[calc(68%-10px)] h-5"
      : "top-[calc(65%-8px)] h-4";

  /** `sizes` for poster-fill stubs in responsive grids — stays tight to approximate column widths. */
  const fillPosterSizes =
    posterFillTicket && posterFillFlexible
      ? "(max-width:640px) 33vw, (max-width:1024px) 24vw, (max-width:1536px) 15vw, 260px"
      : preset.posterSizes;

  /** Fixed rail footprints stay `shrink-0`; grid-fill mode yields to CSS grid tracks. */
  const outerArticle = cn(
    "relative block overflow-visible",
    posterFillTicket
      ? cn(
          posterFillFlexible ? "mx-0 min-w-0 w-full shrink" : cn("mx-auto shrink-0", preset.fullBleedWidth),
          "max-w-none",
        )
      : cn("mx-auto w-full shrink-0", preset.maxWidth),
    // Bleed rails draw depth on the inner card only so the halo matches the rounded mask.
    !posterFillTicket && preset.shadow,
    className,
  );

  /** Single poster beneath copy — overlays sit low; captions hide behind hover unless touch / kb focus needs them */
  const posterFillRailBody = posterFillTicket ? (
    <>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1] overflow-hidden bg-zinc-950",
          preset.roundedTop,
          preset.roundedBottom,
        )}
      >
        {resolved ? (
          <Image
            src={resolved}
            alt={posterAlt}
            fill
            sizes={fillPosterSizes}
            className={cn(
              "object-cover object-center will-change-auto",
              (size === "default" || posterFillTicket) &&
                cn(
                  "transition-[filter] duration-300 ease-out [@media(hover:hover)]:group-hover:brightness-[1.04]",
                  // Compose filter on its own layer only while hovered so the tween doesn’t hitch.
                  posterFillTicket &&
                    "motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:will-change-[filter]",
                ),
              posterClassName,
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center px-2 text-center text-[10px] text-white/35">
            No poster
          </div>
        )}
      </div>

      {/* Tear-off punch circles (page bg shows through); dashed rule stays off per design direction */}
      {showNotches ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 z-[13]",
            posterFillNotchBandClass,
          )}
        >
          <span
            className={cn(
              "absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.04)]",
              posterFillNotchClass,
            )}
          />
          <span
            className={cn(
              "absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 rounded-full bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.04)]",
              posterFillNotchClass,
            )}
          />
        </div>
      ) : null}

      {/* Bottom scrim — taller veil on Popular grid captions (larger body type sits lower on the artwork) */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-[11] will-change-auto bg-gradient-to-t from-black/82 via-black/44 to-transparent transition-opacity duration-200 ease-out",
          size === "compact"
            ? compactPosterFillFlexible
              ? "h-[7rem] sm:h-[7.25rem]"
              : "h-[5.25rem]"
            : "h-[5.85rem]",
          preset.roundedBottom,
          "opacity-100 [@media(hover:none)]:opacity-[0.78]",
          "[@media(hover:hover)_and_(pointer:fine)]:opacity-0",
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
          // Rasterize fades on demand so opacity transitions stay smooth once the scrubbing starts.
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover:will-change-[opacity]",
          "group-focus-within:will-change-[opacity]",
          "group-focus-within:opacity-100",
          "motion-reduce:opacity-100",
          "motion-reduce:will-change-auto",
        )}
      />

      <div
        className={cn(
          // Inter for rail metadata (explicit `font-sans`; body token maps to `--font-inter` in globals).
          // Grid stubs (`posterFillFlexible`) scale headline + kicker with breakpoints — tall posters were illegible at rail-sized 0.7rem copy.
          "pointer-events-none absolute z-[14] text-center font-sans font-medium text-white antialiased transition-opacity duration-200 ease-out will-change-auto",
          compactPosterFillFlexible
            ? "inset-x-0 bottom-3 px-3 pb-2 pt-8 text-[0.9375rem] leading-snug sm:text-[clamp(0.9375rem,2.05vw,1.0625rem)] md:text-[1rem] md:leading-normal lg:text-[1.0625rem] xl:text-[1.125rem]"
            : "inset-x-0 bottom-[10px] px-2 pb-0.5 pt-5 text-[0.7rem] leading-snug",
          /*
           * Fine pointers w/ hover: hide until hovered so the rail reads as naked posters.
           * Coarse pointers, keyboard `:focus-within`, and reduced motion always surface copy.
           */
          "opacity-100",
          "[@media(hover:hover)_and_(pointer:fine)]:opacity-0",
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100",
          "[@media(hover:hover)_and_(pointer:fine)]:group-hover:will-change-[opacity]",
          "group-focus-within:will-change-[opacity]",
          "group-focus-within:opacity-100",
          "motion-reduce:opacity-100",
          "motion-reduce:will-change-auto",
          "[text-shadow:0_1px_3px_rgba(0,0,0,.9),0_0_12px_rgba(0,0,0,.45)]",
        )}
      >
        {stubKicker ? (
          <p
            className={cn(
              "font-medium uppercase text-white/92",
              compactPosterFillFlexible
                ? "mb-1 text-[0.6875rem] tracking-[0.22em] sm:text-[clamp(0.6875rem,1.05vw,0.8125rem)]"
                : "mb-0.5 text-[0.5625rem] tracking-[0.26em]",
            )}
          >
            {stubKicker}
          </p>
        ) : null}
        {/* Title row — callers should keep `font-sans` parity (home rail drops Fraunces for Inter) */}
        <div>{children}</div>
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-[8] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]",
          preset.roundedTop,
          preset.roundedBottom,
        )}
      />
    </>
  ) : null;

  const article = posterFillTicket ? (
    <article className={outerArticle}>
      <div
        className={cn(
          "relative isolate aspect-[2/3] w-full overflow-visible bg-zinc-950",
          preset.roundedTop,
          preset.roundedBottom,
          "shadow-[0_11px_30px_-9px_rgba(0,0,0,0.58)]",
        )}
      >
        {posterFillRailBody}
      </div>
    </article>
  ) : (
    <article className={outerArticle}>
      <div className={cn("relative aspect-[2/3] w-full overflow-hidden bg-black/40", preset.roundedTop)}>
        {resolved ? (
          <Image
            src={resolved}
            alt={posterAlt}
            fill
            sizes={preset.posterSizes}
            className={cn(
              "object-cover",
              size === "default" &&
                "transition-[filter] duration-200 [@media(hover:hover)]:group-hover:brightness-[1.05]",
              posterClassName,
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center px-2 text-center text-[10px] text-white/35">
            No poster
          </div>
        )}
      </div>

      <div
        className={cn(
          "relative px-4 pt-3 pb-4 text-white",
          preset.roundedBottom,
          size === "compact" && "-mt-px",
        )}
        style={{ backgroundColor: stubBackground }}
      >
        {showNotches ? (
          <>
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 left-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background",
                preset.notch,
              )}
            />
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 right-0 z-10 translate-x-1/2 -translate-y-1/2 rounded-full bg-background",
                preset.notch,
              )}
            />
          </>
        ) : null}
        <div className="border-t border-dashed border-white/35 pt-3">
          {stubKicker ? (
            <p className="font-display mb-3 text-[9px] font-medium uppercase tracking-[0.32em] text-white/72 md:text-[8px]">
              {stubKicker}
            </p>
          ) : null}
          <div>{children}</div>
        </div>
      </div>
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        className={cn(
          "cinema-ticket-link group block will-change-auto outline-none transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[color:var(--color-desert-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          posterFillTicket && posterFillFlexible ? "mx-0 w-full" : "mx-auto w-fit",
          linkHoverGrow &&
            "[@media(hover:hover)]:hover:scale-[1.02] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:will-change-transform",
          "motion-reduce:[@media(hover:hover)]:hover:will-change-auto",
        )}
      >
        {article}
      </Link>
    );
  }

  return article;
}
