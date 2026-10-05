import { cn } from "@still/ui/lib/utils";

/**
 * Filters dropdowns open over the raised lobby. The sheet stays canvas
 * (`bg-background`) so it steps off `bg-card`, and each group is a raised
 * inset. Outer radius 1.75rem with 8px padding → inner radius 1.25rem.
 * `!` beats the base popover's `rounded-mobbin-3xl` / `shadow-mobbin-xl`,
 * which otherwise win in the stylesheet and pinch the nested corners.
 */
export const catalogFiltersPopoverClassName =
	"flex w-[min(100vw-1.5rem,22rem)] flex-col overflow-hidden rounded-[1.75rem]! bg-background p-2 text-foreground shadow-none!";

/** Raised group inside the canvas sheet. */
export const catalogFiltersSectionClassName =
	"flex flex-col gap-2 rounded-[1.25rem] bg-card p-4";

export const catalogFiltersSectionLabelClassName =
	"font-medium text-muted-foreground text-xs";

export const catalogFiltersBodyClassName =
	"text-pretty text-muted-foreground text-sm leading-snug";

/** The one filled action in the menu (set region, and the selected genre chip). */
export const catalogFiltersPrimaryClassName = cn(
	"inline-flex min-h-11 items-center justify-center self-start rounded-full bg-foreground px-5 font-medium text-background text-sm",
	"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
);

/** Quiet action on the canvas sheet (Clear filters). */
export const catalogFiltersQuietClassName = cn(
	"inline-flex min-h-11 items-center justify-center rounded-full bg-card px-4 font-medium text-foreground text-sm",
	"transition-transform duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none",
	"[@media(hover:hover)]:hover:bg-foreground/10",
);
