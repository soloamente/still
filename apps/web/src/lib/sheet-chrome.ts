/**
 * Shared field + CTA classes for bottom sheets on `bg-card` (quick-log, review composer, review reader).
 * Fields sit on `bg-background` canvas tiles — no borders or focus rings.
 */
export const SHEET_FIELD_CLASS =
	"min-h-11 rounded-2xl border-transparent bg-background text-base shadow-none outline-none focus-visible:border-transparent focus-visible:bg-background focus-visible:ring-0 focus-visible:outline-none";

/** Centered caption above sheet fields — matches review composer / create-list. */
export const SHEET_FIELD_LABEL_CLASS =
	"w-full justify-center text-center text-muted-foreground text-xs";

/** Primary pill — matches review composer **Publish** / quick-log **Add movie**. */
export const SHEET_PRIMARY_PILL_CLASS =
	"h-auto min-h-10 min-w-[8.5rem] bg-foreground px-5 py-2.5 text-base text-background hover:!bg-foreground hover:!text-background [@media(hover:hover)]:hover:bg-foreground [@media(hover:hover)]:hover:text-background";
