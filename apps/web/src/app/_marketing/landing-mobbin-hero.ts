/** Mobbin marketing rhythm on Sense’s dark canvas — geometry only, not light specimen colors. */

/** Shared focus ring for hero / convert CTAs. */
const LANDING_FOCUS_RING_CLASS =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const LANDING_HERO_HEADLINE_CLASS =
	"max-w-[18ch] text-balance font-sans font-semibold text-[clamp(2.5rem,5.5vw,3.75rem)] leading-[1.05] tracking-[-0.04em]";

export const LANDING_HERO_SUBLINE_CLASS =
	"mt-6 max-w-[40ch] text-balance font-sans text-[clamp(1rem,2vw,1.25rem)] text-muted-foreground leading-[1.5] tracking-[0.01em]";

export const LANDING_HERO_CTA_ROW_CLASS =
	"mt-8 flex flex-wrap items-center justify-center gap-3";

/** Inverted primary pill — 44px hit, no decorative border. */
export const LANDING_HERO_CTA_PRIMARY_CLASS = `inline-flex h-11 min-w-[9.5rem] select-none items-center justify-center rounded-full bg-foreground px-6 font-sans font-semibold text-background text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85 ${LANDING_FOCUS_RING_CLASS}`;

/** Raised secondary pill — bg-card, no border. */
export const LANDING_HERO_CTA_SECONDARY_CLASS = `inline-flex h-11 min-w-[9.5rem] select-none items-center justify-center rounded-full bg-card px-6 font-sans text-foreground text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85 ${LANDING_FOCUS_RING_CLASS}`;

/** Mobbin “From inspiration to creation” — single centered section title only. */
export const LANDING_FEATURES_SECTION_TITLE_CLASS =
	"text-balance text-center font-sans font-semibold text-[clamp(2rem,4.5vw,3rem)] text-foreground leading-[1.08] tracking-[-0.04em]";

/** Raised chapter shell — outer 24, pad 8, inner 16. */
export const LANDING_CHAPTER_CARD_CLASS =
	"rounded-mobbin-3xl bg-card p-2 sm:p-3";

export const LANDING_CHAPTER_WELL_CLASS =
	"flex min-h-48 items-center justify-center rounded-2xl bg-background p-6 sm:min-h-56 sm:p-8";

export const LANDING_SKIP_LINK_CLASS =
	"sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:inline-flex focus:h-11 focus:items-center focus:rounded-full focus:bg-card focus:px-4 focus:font-sans focus:text-foreground focus:text-sm";
