/** Mobbin marketing rhythm on Sense’s dark canvas — geometry only, not light specimen colors. */

export const LANDING_HERO_SECTION_CLASS =
	"relative flex min-h-[min(100dvh,960px)] w-full flex-col bg-background text-foreground";

export const LANDING_HERO_PAGE_CLASS =
	"mx-auto flex w-full max-w-mobbin-page flex-1 flex-col px-4 sm:px-6";

export const LANDING_HERO_COPY_CLASS =
	"flex flex-col items-center pt-28 text-center sm:pt-32";

export const LANDING_HERO_MARK_CLASS =
	"mb-6 flex size-16 items-center justify-center gap-[3px] rounded-[1.25rem] bg-card";

export const LANDING_HERO_HEADLINE_CLASS =
	"max-w-[18ch] text-balance font-sans font-semibold text-[clamp(2.5rem,5.5vw,3.75rem)] leading-[1.05] tracking-[-0.04em]";

export const LANDING_HERO_SUBLINE_CLASS =
	"mt-6 max-w-[40ch] text-balance font-sans text-[clamp(1rem,2vw,1.25rem)] text-muted-foreground leading-[1.5] tracking-[0.01em]";

export const LANDING_HERO_CTA_ROW_CLASS =
	"mt-8 flex flex-wrap items-center justify-center gap-3";

/** Filled pill — Mobbin primary CTA shape, inverted for dark canvas. */
export const LANDING_HERO_CTA_PRIMARY_CLASS =
	"inline-flex h-11 min-w-[9.5rem] items-center justify-center rounded-full bg-foreground px-6 font-sans font-semibold text-background text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85";

/** Outline pill — Mobbin secondary CTA on raised surface. */
export const LANDING_HERO_CTA_SECONDARY_CLASS =
	"inline-flex h-11 min-w-[9.5rem] items-center justify-center rounded-full border border-border bg-card px-6 font-sans text-foreground text-sm transition-colors duration-200 [@media(hover:hover)]:bg-muted/30 active:bg-muted/40";

export const LANDING_HERO_STAGE_WRAP_CLASS =
	"mt-10 w-full pb-14 sm:mt-12 sm:pb-20";

/** Mobbin hero preview — gray well with UI card centered inside (matches feature wells). */
export const LANDING_HERO_PREVIEW_WELL_CLASS =
	"relative mx-auto flex aspect-[16/10] w-full max-w-5xl items-center justify-center overflow-hidden rounded-[1.75rem] bg-muted/30 sm:rounded-[2rem]";

export const LANDING_HERO_PREVIEW_WELL_INNER_CLASS =
	"flex w-full max-w-[92%] items-center justify-center p-5 sm:max-w-[90%] sm:p-8";

export const LANDING_HERO_PREVIEW_CARD_CLASS =
	"w-full overflow-hidden rounded-2xl bg-card";

/** Centered floating nav shell (La Nube-style cluster, Mobbin links + CTAs). */
export const LANDING_NAV_FLOAT_ROOT_CLASS =
	"pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-5 sm:pt-6";

export const LANDING_NAV_FLOAT_CLUSTER_CLASS =
	"pointer-events-auto flex max-w-full min-w-0 items-center gap-2 sm:gap-3";

/** Compact primary pill nested inside the auth float capsule. */
export const LANDING_NAV_CTA_PRIMARY_CLASS =
	"inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-foreground px-4 font-sans font-semibold text-background text-sm transition-opacity duration-200 [@media(hover:hover)]:opacity-90 active:opacity-85";

/** Mobbin marketing section header — dark canvas. */
export const LANDING_SECTION_CLASS =
	"bg-background px-4 py-24 sm:px-6 sm:py-32";

export const LANDING_SECTION_INNER_CLASS = "mx-auto w-full max-w-mobbin-page";

/** Mobbin “From inspiration to creation” — single centered section title only. */
export const LANDING_FEATURES_SECTION_TITLE_CLASS =
	"text-balance text-center font-sans font-semibold text-[clamp(2rem,4.5vw,3rem)] text-foreground leading-[1.08] tracking-[-0.04em]";

/** Square specimen well — equal width × height in every column. */
export const LANDING_FEATURE_WELL_CLASS =
	"relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-[1.75rem] bg-muted/30 sm:rounded-[2rem]";

export const LANDING_FEATURE_WELL_INNER_CLASS =
	"flex w-full max-w-[88%] items-center justify-center p-6 sm:max-w-[85%] sm:p-8";

export const LANDING_FEATURE_COLUMN_TITLE_CLASS =
	"mt-8 text-center font-sans font-semibold text-foreground text-xl tracking-[-0.03em]";

export const LANDING_FEATURE_COLUMN_BODY_CLASS =
	"mx-auto mt-3 max-w-[30ch] text-center font-sans text-muted-foreground text-sm leading-relaxed";

/** Mobbin “A growing library of” stats band. */
export const LANDING_STATS_VALUE_CLASS =
	"font-sans font-semibold text-[clamp(2.5rem,5vw,3.5rem)] text-foreground tabular-nums tracking-[-0.04em]";

export const LANDING_STATS_LABEL_CLASS =
	"mt-2 font-sans text-muted-foreground text-sm";

/** Mobbin filter pill row (active = filled). */
export const LANDING_FILTER_PILL_ACTIVE_CLASS =
	"inline-flex items-center rounded-full bg-foreground px-3.5 py-1.5 font-sans text-[0.8125rem] text-background";

export const LANDING_FILTER_PILL_CLASS =
	"inline-flex items-center rounded-full border border-border px-3.5 py-1.5 font-sans text-[0.8125rem] text-foreground";

/** Pattern card in the finder grid. */
export const LANDING_PATTERN_CARD_CLASS =
	"overflow-hidden rounded-2xl border border-border/45 bg-card p-2";

/** Mobbin flows / split feature column. */
export const LANDING_SPLIT_WELL_CLASS =
	"flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[1.75rem] bg-muted/30 p-6 sm:rounded-[2rem] sm:p-8";
