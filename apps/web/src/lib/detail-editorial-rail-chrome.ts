import { cn } from "@still/ui/lib/utils";

/**
 * Editorial detail rails (reviews, stills) — horizontal edge softening.
 * Mobile uses a short fade so centered slides stay fully readable (~390px viewports).
 */
export const DETAIL_EDITORIAL_RAIL_X_FADE_CLASS = cn(
	"[mask-image:linear-gradient(to_right,transparent_0,black_1.75rem,black_calc(100%-1.75rem),transparent_100%)]",
	"[-webkit-mask-image:linear-gradient(to_right,transparent_0,black_1.75rem,black_calc(100%-1.75rem),transparent_100%)]",
	"sm:[mask-image:linear-gradient(to_right,transparent_0,black_5rem,black_calc(100%-5rem),transparent_100%)]",
	"sm:[-webkit-mask-image:linear-gradient(to_right,transparent_0,black_5rem,black_calc(100%-5rem),transparent_100%)]",
	"md:[mask-image:linear-gradient(to_right,transparent_0,black_10rem,black_calc(100%-10rem),transparent_100%)]",
	"md:[-webkit-mask-image:linear-gradient(to_right,transparent_0,black_10rem,black_calc(100%-10rem),transparent_100%)]",
);

/** Card-toned scrims at layout insets — `to-card/0` keeps the fade clean on mobile. */
export const DETAIL_EDITORIAL_RAIL_EDGE_SCRIM_LEFT_CLASS =
	"pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-linear-to-r from-card from-0% via-card/50 via-40% to-card/0 sm:w-24 sm:via-card/65 md:w-40 xl:w-48";

export const DETAIL_EDITORIAL_RAIL_EDGE_SCRIM_RIGHT_CLASS =
	"pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-linear-to-l from-card from-0% via-card/50 via-40% to-card/0 sm:w-24 sm:via-card/65 md:w-40 xl:w-48";

/** Shared @container rail layout — slide + spacer widths must use the same cqw basis. */
export const DETAIL_EDITORIAL_REVIEW_SLIDE_WIDTH_CLASS = "w-[min(36rem,92cqw)]";

export const DETAIL_EDITORIAL_REVIEW_RAIL_EDGE_SPACER_CLASS =
	"w-[max(0px,calc((100cqw-min(36rem,92cqw))/2))]";

/** Tighter on mobile so snaps sit closer and need less finger travel. */
export const DETAIL_EDITORIAL_REVIEW_SLIDE_GAP_CLASS =
	"ml-6 sm:ml-28 md:ml-36 lg:ml-40";

export const DETAIL_EDITORIAL_STILL_SLIDE_WIDTH_CLASS = "w-[min(56rem,94cqw)]";

export const DETAIL_EDITORIAL_STILL_RAIL_EDGE_SPACER_CLASS =
	"w-[max(0px,calc((100cqw-min(56rem,94cqw))/2))]";

export const DETAIL_EDITORIAL_STILL_SLIDE_GAP_CLASS =
	"ml-6 sm:ml-28 md:ml-36 lg:ml-40";

/** Rail scrollport — `@container` parent for cqw slide math above. */
export const DETAIL_EDITORIAL_RAIL_SCROLLPORT_CLASS = cn(
	"@container flex min-w-0 cursor-grab touch-pan-x overflow-x-auto overscroll-x-contain",
	"snap-x snap-mandatory",
	"scrollbar-none select-none items-center [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
);

export const DETAIL_EDITORIAL_RAIL_SLIDE_SNAP_CLASS = "snap-center snap-always";
